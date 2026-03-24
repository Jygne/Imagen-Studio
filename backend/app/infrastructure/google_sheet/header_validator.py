from app.domain.enums import WorkflowType

REQUIRED_HEADERS = {
    WorkflowType.CLEAN_IMAGE: [
        "bb_model_id",
        "rsku_model_image_url",
        "RSKU Model Image",
        "generate",
    ],
    WorkflowType.SELLING_POINT: [
        "bb_model_id",
        "rsku_model_image_url",
        "RSKU Model Image",
        "variation_1_value",
        "llm_sellingpoints",
        "generate",
    ],
}


def validate_headers(
    actual_headers: list[str],
    workflow_type: WorkflowType,
) -> tuple[list[str], list[str]]:
    """
    Returns (present, missing) tuples for the given workflow type.
    Header matching is case-sensitive per the fixed protocol.
    """
    required = REQUIRED_HEADERS[workflow_type]
    present = [h for h in required if h in actual_headers]
    missing = [h for h in required if h not in actual_headers]
    return present, missing


def build_row_dict(headers: list[str], row: list) -> dict:
    """Map a sheet row (list of cell values) to a dict keyed by header name."""
    result = {}
    for i, header in enumerate(headers):
        result[header] = row[i] if i < len(row) else ""
    return result
