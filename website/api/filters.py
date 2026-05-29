import json
from urllib.parse import parse_qs


def pad(n: int) -> str:
    return str(n).zfill(2)


def quarter_start(year: int, quarter: int) -> str:
    month = (quarter - 1) * 3 + 1
    return f"{year}-{pad(month)}-01 00:00:00"


def quarter_end(year: int, quarter: int) -> str:
    month = quarter * 3
    import calendar

    last_day = calendar.monthrange(year, month)[1]
    return f"{year}-{pad(month)}-{pad(last_day)} 23:59:59"


def parse_datetime(value: str, end: bool = False) -> str:
    if not value:
        return value
    if "T" in value:
        normalized = value.replace("T", " ")[:19]
        return normalized
    if len(value) == 4 and value.isdigit():
        return f"{value}-12-31 23:59:59" if end else f"{value}-01-01 00:00:00"
    if len(value) == 7 and value[4] == "-":
        year, month = map(int, value.split("-"))
        if end:
            import calendar

            last = calendar.monthrange(year, month)[1]
            return f"{value}-{pad(last)} 23:59:59"
        return f"{value}-01 00:00:00"
    if len(value) == 10 and value[4] == "-":
        return f"{value} 23:59:59" if end else f"{value} 00:00:00"
    return value


def interval_from_granularity(granularity: str, start: str, end: str) -> dict[str, str]:
    if granularity == "quarter":
        sy, sq = start.upper().split("-Q")
        ey, eq = end.upper().split("-Q")
        return {
            "start": quarter_start(int(sy), int(sq)),
            "end": quarter_end(int(ey), int(eq)),
        }
    return {
        "start": parse_datetime(start, end=False),
        "end": parse_datetime(end, end=True),
    }


def parse_query(query_string: str) -> dict:
    params = {k: v[0] for k, v in parse_qs(query_string).items()}
    mode = params.get("mode", "streetcar")
    directions = [d.strip() for d in params.get("directions", "").split(",") if d.strip()]
    routes = [r.strip() for r in params.get("routes", "").split(",") if r.strip()]
    granularity = params.get("granularity", "year")
    bucket = params.get("bucket", "year")
    compare = params.get("view") == "compare"
    intervals: list[dict[str, str]] = []

    if compare and params.get("intervals"):
        try:
            parsed = json.loads(params["intervals"])
            for item in parsed[:10]:
                intervals.append(
                    interval_from_granularity(granularity, item["start"], item["end"])
                )
        except json.JSONDecodeError:
            pass

    if not intervals:
        start = params.get("start", "2014")
        end = params.get("end", "2026")
        intervals.append(interval_from_granularity(granularity, start, end))

    return {
        "mode": mode,
        "directions": directions,
        "routes": routes,
        "intervals": intervals,
        "bucket": bucket,
        "compare": compare,
    }
