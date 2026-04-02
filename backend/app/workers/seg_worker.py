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

from app.config import config

logger = logging.getLogger(__name__)

PISEG_HEADERS = {
    "Content-Type": "application/json",
    "x-sp-servicekey": "f0dd2d544097d2a938595c1d78949bd3",
    "x-sp-sdu": "ai_engine_platform.mmuplt.controller.global.liveish.master.default",
    "x-sp-timeout": "60000",
}


def _build_piseg_headers() -> dict[str, str]:
    headers = dict(PISEG_HEADERS)
    if config.piseg_auth_token:
        headers["Authorization"] = f"Bearer {config.piseg_auth_token}"
    return headers


def _call_piseg(base64_image: str, max_retries: int = 3) -> dict | None:
    """调用 pisegv2，返回 task_result 或 None。"""
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

    for attempt in range(max_retries):
        try:
            resp = requests.post(
                config.piseg_url,
                data=json.dumps(request_data),
                headers=_build_piseg_headers(),
                timeout=60,
            )
            if resp.status_code != 200:
                logger.warning("[piseg] HTTP %s, body=%r, attempt %d/%d", resp.status_code, resp.text[:200], attempt + 1, max_retries)
                time.sleep(1)
                continue
            logger.info("[piseg] status=%s body_len=%d body_preview=%r", resp.status_code, len(resp.content), resp.text[:200])
            resp_json = resp.json()
            if "task_result" not in resp_json:
                logger.warning("[piseg] no task_result, attempt %d/%d", attempt + 1, max_retries)
                time.sleep(1)
                continue
            return resp_json["task_result"]
        except Exception as e:
            logger.warning("[piseg] exception: %s, attempt %d/%d", e, attempt + 1, max_retries)
            time.sleep(1)

    return None


def _get_all_segments(seg_results: list[dict]) -> list[dict]:
    """
    收集所有 is_full_seg=False 的分割结果（独立产品主体）。
    若全部都是 is_full_seg=True，fallback 返回 [第一个]。
    """
    if not seg_results:
        return []
    individual = [s for s in seg_results if not s.get("is_full_seg", True)]
    return individual if individual else [seg_results[0]]


def process_seg_image(image_path: str) -> list[dict]:
    """
    主入口：本地图片 → piseg API → 所有独立主体分割结果列表

    Args:
        image_path: 本地图片的绝对路径

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
    # 1. 读取本地图片并 base64 编码
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    # 2. 调用 pisegv2
    task_result = _call_piseg(base64_image)
    if task_result is None:
        raise RuntimeError("piseg API call failed after retries")

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
