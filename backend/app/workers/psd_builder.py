"""
PSD Builder — 将原图 + 分割抠图合成为双图层 PSD 文件

PSD 图层结构（从上到下）：
  - product  : RGB + layer mask，方便 PS 二次编辑蒙版
  - scenebg  : RGB，原图背景

依赖：psd-tools
"""
import logging
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)


def _build_layer_with_mask(seg_img: Image.Image, layer_name: str, psd):
    """
    构建带 Photoshop layer mask 的 PixelLayer。

    - 像素数据：seg_img 的 RGB 通道（全不透明）
    - Layer mask（channel -2）：seg_img 的 alpha 通道（白=显示，黑=隐藏）
    """
    from psd_tools.api.layers import PixelLayer
    from psd_tools.compression import Compression
    from psd_tools.psd.layer_and_mask import MaskData, MaskFlags
    from psd_tools.constants import ChannelID
    from psd_tools.psd.layer_and_mask import ChannelData, ChannelDataList, ChannelInfo

    width, height = seg_img.size
    alpha_img = seg_img.split()[3]
    rgb_img = seg_img.convert("RGB")

    channel_data_list = ChannelDataList()
    channel_info_list = []
    depth = 8

    def _make_channel(img_channel: Image.Image) -> ChannelData:
        cd = ChannelData(Compression.RLE)
        cd.set_data(img_channel.tobytes(), width, height, depth)
        return cd

    # channel -1: transparency（全不透明，显隐由 mask 控制）
    opaque = Image.new("L", (width, height), 255)
    ch_neg1 = _make_channel(opaque)
    channel_data_list.append(ch_neg1)
    channel_info_list.append(ChannelInfo(id=ChannelID.TRANSPARENCY_MASK, length=len(ch_neg1.data) + 2))

    # channel -2: user layer mask（alpha 通道）
    ch_neg2 = _make_channel(alpha_img)
    channel_data_list.append(ch_neg2)
    channel_info_list.append(ChannelInfo(id=ChannelID.USER_LAYER_MASK, length=len(ch_neg2.data) + 2))

    # channels 0/1/2: R G B
    for idx, band in enumerate(rgb_img.split()):
        cd = _make_channel(band)
        channel_data_list.append(cd)
        channel_info_list.append(ChannelInfo(id=ChannelID(idx), length=len(cd.data) + 2))

    layer_record, _ = PixelLayer._build_layer_record_and_channels(
        rgb_img, layer_name, 0, 0, Compression.RLE
    )
    layer_record.channel_info = channel_info_list
    layer_record.mask_data = MaskData(
        top=0, left=0, bottom=height, right=width,
        background_color=0,
        flags=MaskFlags(),
    )

    return PixelLayer(psd, layer_record, channel_data_list)


def build_psd(original_image_path: str, segments: list[dict]) -> bytes:
    """
    合成 PSD 文件。

    Args:
        original_image_path: 原图本地路径
        segments: process_seg_image 返回的分割列表
                  每项: {"image_bytes": bytes, "bbox": [x1,y1,x2,y2], "index": int}

    Returns:
        PSD 文件的 bytes

    图层结构（从上到下）：
        product / product1 ...  — RGB + layer mask（channel -2），方便二次编辑
        scenebg                 — RGB 原图背景
    """
    try:
        from psd_tools import PSDImage
        from psd_tools.api.layers import PixelLayer
        from psd_tools.compression import Compression
    except ImportError:
        raise ImportError(
            "psd-tools is required for PSD export. "
            "Install with: pip install psd-tools"
        )

    # 1. 读取原图
    orig_img = Image.open(original_image_path).convert("RGB")
    width, height = orig_img.size

    # 2. 创建 RGB mode PSD（标准 Photoshop 格式）
    psd = PSDImage.new("RGB", (width, height))

    # 3. 底层：scenebg（原图 RGB）
    PixelLayer.frompil(orig_img, psd, name="scenebg")

    # 4. product 图层（带 layer mask）
    multi = len(segments) > 1
    for i, seg in enumerate(segments):
        layer_name = f"product{i + 1}" if multi else "product"

        seg_img = Image.open(BytesIO(seg["image_bytes"]))
        if seg_img.mode != "RGBA":
            seg_img = seg_img.convert("RGBA")

        # 裁剪段贴回全尺寸透明画布（按 bbox 定位，避免拉伸）
        if seg_img.size != (width, height):
            canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            bbox = seg.get("bbox") or [0, 0, width, height]
            x1, y1 = int(bbox[0]), int(bbox[1])
            canvas.paste(seg_img, (x1, y1))
            seg_img = canvas

        product_layer = _build_layer_with_mask(seg_img, layer_name, psd)
        psd.append(product_layer)
        logger.info("[psd_builder] added layer '%s' with mask", layer_name)

    # 5. 序列化输出
    out = BytesIO()
    psd.save(out)
    psd_bytes = out.getvalue()

    logger.info(
        "[psd_builder] PSD generated: %dx%d, %d product layer(s), %d bytes",
        width, height, len(segments), len(psd_bytes)
    )
    return psd_bytes


def build_psd_fallback(original_image_path: str, seg_image_bytes: bytes) -> tuple[bytes, bytes]:
    """
    备用方案（当 psd-tools 不可用时）：
    返回 (原图PNG bytes, 抠图PNG bytes)，由调用方分别保存
    """
    orig_img = Image.open(original_image_path).convert("RGB")
    orig_out = BytesIO()
    orig_img.save(orig_out, format="PNG")

    seg_img = Image.open(BytesIO(seg_image_bytes))
    if seg_img.mode != "RGBA":
        seg_img = seg_img.convert("RGBA")
    seg_out = BytesIO()
    seg_img.save(seg_out, format="PNG")

    return orig_out.getvalue(), seg_out.getvalue()
