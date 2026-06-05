#!/usr/bin/env python3
import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

MIN_MOSAIC_SIZE = 20


def load_dependencies():
    import cv2
    from ultralytics import YOLO

    return cv2, YOLO


def parse_classes(value: str) -> set[int]:
    classes: set[int] = set()
    for item in value.split(","):
        item = item.strip()
        if not item:
            continue
        classes.add(int(item))
    return classes


def validate_mosaic_size(mosaic_size: int) -> None:
    if mosaic_size < MIN_MOSAIC_SIZE:
        raise ValueError(f"mosaic-size must be at least {MIN_MOSAIC_SIZE}")


def create_mosaic(roi, mosaic_size: int):
    validate_mosaic_size(mosaic_size)
    cv2, _YOLO = load_dependencies()
    block_size = max(1, int(mosaic_size * 0.1))
    height, width = roi.shape[:2]
    small_width = max(1, width // block_size)
    small_height = max(1, height // block_size)
    small = cv2.resize(roi, (small_width, small_height), interpolation=cv2.INTER_LINEAR)
    return cv2.resize(small, (width, height), interpolation=cv2.INTER_NEAREST)


def process_image(cv2, model, input_path: Path, output_path: Path, selected_classes: set[int], mosaic_size: int):
    validate_mosaic_size(mosaic_size)
    image = cv2.imread(str(input_path))
    if image is None:
        raise RuntimeError(f"failed to read input image: {input_path}")

    results = model(image)
    detections = 0
    selected_detections = 0

    for result in results:
        for box in result.boxes:
            cls = int(box.cls[0].cpu().numpy())
            if cls < 0:
                continue
            detections += 1
            if cls not in selected_classes:
                continue

            coords = box.xyxy[0].cpu().numpy()
            if not all(math.isfinite(float(value)) for value in coords):
                continue

            x1, y1, x2, y2 = coords
            height, width = image.shape[:2]
            left = max(0, math.floor(float(x1)))
            top = max(0, math.floor(float(y1)))
            right = min(width, math.ceil(float(x2)))
            bottom = min(height, math.ceil(float(y2)))
            if right <= left or bottom <= top:
                continue

            roi = image[top:bottom, left:right]
            image[top:bottom, left:right] = create_mosaic(roi, mosaic_size)
            selected_detections += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output_path), image):
        raise RuntimeError(f"failed to write output image: {output_path}")

    return {
        "ok": True,
        "inputPath": str(input_path),
        "outputPath": str(output_path),
        "detections": detections,
        "selectedDetections": selected_detections,
    }


def run(model_path: Path, input_path: Path, output_path: Path, selected_classes: set[int], mosaic_size: int):
    cv2, YOLO = load_dependencies()
    model = YOLO(str(model_path))
    return process_image(cv2, model, input_path, output_path, selected_classes, mosaic_size)


def read_item_path(item: dict[str, Any], *keys: str) -> Path:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value:
            return Path(value)
    raise ValueError(f"batch item missing path field: {', '.join(keys)}")


def load_batch_items(batch_path: Path) -> list[dict[str, Any]]:
    with batch_path.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    if not isinstance(manifest, dict):
        raise ValueError("batch manifest must be a JSON object")

    items = manifest.get("items")
    if not isinstance(items, list):
        raise ValueError('batch manifest must contain an "items" array')

    normalized_items: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"batch item {index} must be a JSON object")
        normalized_items.append(item)

    return normalized_items


def run_batch(model_path: Path, batch_path: Path, selected_classes: set[int], mosaic_size: int):
    validate_mosaic_size(mosaic_size)
    items = load_batch_items(batch_path)
    cv2, YOLO = load_dependencies()
    model = YOLO(str(model_path))
    results = []

    for index, item in enumerate(items):
        input_path = read_item_path(item, "inputPath", "sourcePath", "input")
        output_path = read_item_path(item, "outputPath", "output")
        result_id = item.get("id", str(index))

        try:
            item_result = process_image(
                cv2=cv2,
                model=model,
                input_path=input_path,
                output_path=output_path,
                selected_classes=selected_classes,
                mosaic_size=mosaic_size,
            )
            item_result["id"] = result_id
            results.append(item_result)
        except Exception as error:
            results.append({
                "ok": False,
                "id": result_id,
                "inputPath": str(input_path),
                "outputPath": str(output_path),
                "error": str(error),
            })

    return {"results": results}


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply YOLO-based mosaic censoring to one image or a batch manifest.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--input")
    parser.add_argument("--output")
    parser.add_argument("--batch")
    parser.add_argument("--classes", required=True)
    parser.add_argument("--mosaic-size", required=True, type=int)
    args = parser.parse_args()

    try:
        validate_mosaic_size(args.mosaic_size)
        selected_classes = parse_classes(args.classes)

        if args.batch:
            stats = run_batch(
                model_path=Path(args.model),
                batch_path=Path(args.batch),
                selected_classes=selected_classes,
                mosaic_size=args.mosaic_size,
            )
        else:
            if not args.input or not args.output:
                raise ValueError("--input and --output are required unless --batch is provided")
            stats = run(
                model_path=Path(args.model),
                input_path=Path(args.input),
                output_path=Path(args.output),
                selected_classes=selected_classes,
                mosaic_size=args.mosaic_size,
            )
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1

    print(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
