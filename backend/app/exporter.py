from io import BytesIO
from typing import Iterable, List

import pandas as pd
from fpdf import FPDF

from . import models


def _employees_to_rows(employees: Iterable[models.Employee], include_price: bool, price: float) -> List[dict]:
    rows = []
    for index, emp in enumerate(employees, start=1):
        row = {
            "№": index,
            "Ф.И.О": emp.full_name,
            "Статус": "Участвует" if emp.status else "Не участвует",
            "Дата": emp.date.strftime("%Y-%m-%d"),
        }
        if include_price:
            row["Стоимость"] = price if emp.status else 0
        rows.append(row)
    return rows


def export_excel(employees: List[models.Employee], include_price: bool, price: float, total_cost: float) -> bytes:
    rows = _employees_to_rows(employees, include_price, price)
    df = pd.DataFrame(rows)
    if include_price:
        summary = {
            "№": "",
            "Ф.И.О": "",
            "Статус": "",
            "Дата": "Итого",
            "Стоимость": total_cost,
        }
        df = pd.concat([df, pd.DataFrame([summary])], ignore_index=True)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Отчет")
    return output.getvalue()


def export_pdf(employees: List[models.Employee], include_price: bool, price: float, total_cost: float) -> bytes:
    rows = _employees_to_rows(employees, include_price, price)
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.add_page()
    pdf.set_font("Arial", "B", 14)
    pdf.cell(0, 10, "Отчет по обедам", ln=1, align="C")
    pdf.set_font("Arial", size=10)
    col_widths = [10, 70, 35, 30]
    headers = ["№", "Ф.И.О", "Статус", "Дата"]
    if include_price:
        headers.append("Стоимость")
        col_widths.append(30)
    for width, header in zip(col_widths, headers):
        pdf.cell(width, 8, header, border=1, align="C")
    pdf.ln()
    if rows:
        for row in rows:
            for header, width in zip(headers, col_widths):
                text = str(row.get(header, ""))
                pdf.cell(width, 8, text, border=1)
            pdf.ln()
    if include_price:
        pdf.set_font("Arial", "B", 11)
        total_label_width = sum(col_widths[:-1])
        pdf.cell(total_label_width, 8, "Итого", border=1)
        pdf.cell(col_widths[-1], 8, f"{total_cost:.2f}", border=1)
    return pdf.output(dest="S").encode("latin-1")
