import datetime


def build_issued_on() -> str:
    today = datetime.date.today()
    if today >= datetime.date(2019, 5, 1):
        year = today.year - 2018
        era_year = "元" if year == 1 else str(year)
        return f"令和{era_year}年{today.month}月"
    year = today.year - 1988
    era_year = "元" if year == 1 else str(year)
    return f"平成{era_year}年{today.month}月"
