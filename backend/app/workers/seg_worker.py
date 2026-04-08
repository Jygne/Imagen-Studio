from __future__ import annotations
"""
Seg Image Worker — 调用 Shopee pisegv2 API 对本地图片做主体分割
输入: 本地图片路径
输出: 分割结果列表 [{ "image_bytes": bytes, "bbox": list, "is_full_seg": bool }, ...]
"""
import json
import base64
import logging
import time
import requests
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)

PISEG_URL_DIRECT = (
    "https://http-gateway.spex.shopee.sg"
    "/sprpc/ai_engine_platform.mmuplt.pisegv2.algo"
)
PISEG_URL_PROXY = (
    "https://http-gateway-proxy.spex.shopee.sg"
    "/sprpc/ai_engine_platform.mmuplt.pisegv2.algo"
)
PISEG_HEADERS_BASE = {
    "Content-Type": "application/json",
    "x-sp-servicekey": "f0dd2d544097d2a938595c1d78949bd3",
    "x-sp-sdu": "ai_engine_platform.mmuplt.controller.global.liveish.master.default",
    "x-sp-timeout": "60000",
}


def _call_piseg(base64_image: str, user_token: str = "", max_retries: int = 3) -> dict:
    """调用 pisegv2，返回 task_result 或 None。
    有 user_token → 走 office proxy 域名 + Authorization header
    无 user_token → 走 direct 域名（非办公网环境）
    """
    url = PISEG_URL_PROXY if user_token else PISEG_URL_DIRECT
    headers = dict(PISEG_HEADERS_BASE)
    if user_token:
        headers["Authorization"] = f"Bearer {user_token}"

    extra_info = json.dumps({"is_upload": False, "cates": ["", "", ""], "bboxes": []})
    request_data = {
        "biz_type": "mmu_test",
        "region": "sg2",
        "task": {
            "image_list": [
                {
                    "image_data": base64_image,
                    "extra_info": extra_info,
                }
            ]
        },
    }

    last_error = "unknown error"
    for attempt in range(max_retries):
        try:
            resp = requests.post(
                url,
                data=json.dumps(request_data),
                headers=headers,
                timeout=60,
            )
            if resp.status_code != 200:
                last_error = f"HTTP {resp.status_code}: {resp.text[:300]}"
                logger.warning("[piseg] %s, attempt %d/%d", last_error, attempt + 1, max_retries)
                time.sleep(1)
                continue
            logger.info("[piseg] status=%s body_len=%d body_preview=%r", resp.status_code, len(resp.content), resp.text[:300])
            resp_json = resp.json()
            if "task_result" not in resp_json:
                last_error = f"no task_result in response: {resp.text[:300]}"
                logger.warning("[piseg] %s, attempt %d/%d", last_error, attempt + 1, max_retries)
                time.sleep(1)
                continue
            return resp_json["task_result"]
        except Exception as e:
            last_error = f"exception: {e}"
            logger.warning("[piseg] %s, attempt %d/%d", last_error, attempt + 1, max_retries)
            time.sleep(1)

    raise RuntimeError(f"piseg failed after {max_retries} retries: {last_error}")


def _get_all_segments(seg_results: list[dict]) -> list[dict]:
    """
    收集所有 is_full_seg=False 的分割结果（独立产品主体）。
    若全部都是 is_full_seg=True，fallback 返回 [第一个]。
    """
    if not seg_results:
        return []
    individual = [s for s in seg_results if not s.get("is_full_seg", True)]
    return individual if individual else [seg_results[0]]


def process_seg_image(image_path: str, user_token: str = "") -> list[dict]:
    """
    主入口：本地图片 → piseg API → 所有独立主体分割结果列表

    Args:
        image_path: 本地图片的绝对路径
        user_token: office network proxy token (from settings)

    Returns:
        list of dict, each:
            {
                "image_bytes": bytes,        # RGBA PNG
                "bbox":        [x1,y1,x2,y2],
                "index":       int,          # piseg 原始 index
            }

    Raises:
        RuntimeError: API 调用失败或解析出错
    """
    # 1. 读取本地图片，确保转为 JPEG 后再 base64 编码
    # piseg API 只接受 JPEG；PNG/WEBP 等格式会返回空响应
    img = Image.open(image_path)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=95)
    base64_image = base64.b64encode(buf.getvalue()).decode("utf-8")

    # 2. 调用 pisegv2
    task_result = _call_piseg(base64_image, user_token=user_token)

    # 3. 解析结果
    try:
        extra = json.loads(task_result["extra_info"])
        seg_images_b64 = extra["object_images"]   # list of base64 strings (RGBA PNG)
        bboxes = extra["object_bboxes"]
        labels = extra["object_labels"]
    except (KeyError, json.JSONDecodeError) as e:
        raise RuntimeError(f"piseg response parse error: {e}")

    if not seg_images_b64:
        raise RuntimeError("piseg returned 0 segments")

    # 4. 构建结构化结果列表
    seg_results = []
    for i, (seg_b64, bbox, label) in enumerate(zip(seg_images_b64, bboxes, labels)):
        is_full_seg = label.get("is_full_seg", False) if isinstance(label, dict) else False
        seg_results.append({
            "image_b64": seg_b64,
            "bbox": bbox,
            "is_full_seg": is_full_seg,
            "index": i,
        })

    logger.info("[seg_worker] %s → %d segments total", image_path, len(seg_results))

    # 5. 收集所有独立主体
    selected = _get_all_segments(seg_results)
    logger.info("[seg_worker] selected %d segment(s) for PSD", len(selected))

    # 6. base64 → bytes，确保 RGBA
    result = []
    for seg in selected:
        raw_bytes = base64.b64decode(seg["image_b64"])
        img = Image.open(BytesIO(raw_bytes))
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        out = BytesIO()
        img.save(out, format="PNG")
        result.append({
            "image_bytes": out.getvalue(),
            "bbox": seg["bbox"],
            "index": seg["index"],
        })

    return result
