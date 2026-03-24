"""
PSD Builder — 将原图 + 分割抠图合成为双图层 PSD 文件

PSD 图层结构（从上到下）：
  - product  : RGBA，透明底，分割抠图（可见）
  - scenebg  : RGB，原图背景（锁定）

依赖：psd-tools
"""
import logging
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)


def build_psd(original_image_path: str, segments: list[dict]) -> bytes:
    """
    合成 PSD 文件。

    Args:
        original_image_path: 原图本地路径
        segments: process_seg_image 返回的分割列表
                  每项: {"image_bytes": bytes, "bbox": [x1,y1,x2,y2], "index": int}

    Returns:
        PSD 文件的 bytes

    Raises:
        ImportError: psd-tools 未安装
        Exception: 其他生成错误

    图层结构（从上到下）：
        product / product1 / product2 ...  — RGBA 透明底分割图，无 layer mask
        scenebg                            — RGB 原图背景
    """
    try:
        from psd_tools import PSDImage
        from psd_tools.api.layers import PixelLayer
    except ImportError:
        raise ImportError(
            "psd-tools is required for PSD export. "
            "Install with: pip install psd-tools"
        )

    # 1. 读取原图
    orig_img = Image.open(original_image_path).convert("RGB")
    width, height = orig_img.size

    # 2. 创建 RGB mode PSD
    #    使用 RGB（而非 RGBA）document mode，确保图层 alpha 被 psd-tools
    #    写为 transparency channel（channel ID = -1），而不是 layer mask（-2）。
    #    这样 PS 打开后 product 图层只有像素透明通道，无附带 mask 缩略图。
    psd = PSDImage.new("RGB", (width, height))

    # 3. 底层：scenebg（原图 RGB）
    bg_layer = PixelLayer.frompil(orig_img, psd, name="scenebg")
    psd.append(bg_layer)

    # 4. 分割图层（从下往上追加，最后一个在最顶层）
    #    命名规则：1 个主体 → "product"；多个主体 → "product1", "product2", "product3" ...
    multi = len(segments) > 1
    for i, seg in enumerate(segments):
        layer_name = f"product{i + 1}" if multi else "product"

        seg_img = Image.open(BytesIO(seg["image_bytes"]))
        if seg_img.mode != "RGBA":
            seg_img = seg_img.convert("RGBA")

        # Bug 3 fix: 裁剪段贴回全尺寸透明画布（按 bbox 定位，避免拉伸）
        if seg_img.size != (width, height):
            canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            bbox = seg.get("bbox") or [0, 0, width, height]
            x1, y1 = int(bbox[0]), int(bbox[1])
            canvas.paste(seg_img, (x1, y1))
            seg_img = canvas

        # Bug 1 fix: RGBA frompil 在 RGB mode PSD 中 alpha 写为 transparency
        #            channel（-1），不产生 layer mask（-2）
        product_layer = PixelLayer.frompil(seg_img, psd, name=layer_name)
        psd.append(product_layer)
        logger.info("[psd_builder] added layer '%s'", layer_name)

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

    Returns:
        (original_png_bytes, seg_png_bytes)
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
