import datetime

start_date = datetime.date(2026, 9, 1)
# 6 meses (metade do tempo original de 1 ano)
end_date = datetime.date(2027, 2, 28)

days = []
current_date = start_date
while current_date <= end_date:
    if current_date.weekday() in (4, 5, 6): # Friday, Saturday, Sunday
        days.append(current_date)
    current_date += datetime.timedelta(days=1)

html_content = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Agenda de Festas</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Montserrat:wght@400;600&display=swap');

    :root {
        /* Otimizado para Preto e Branco / Escala de Cinza */
        --primary-color: #000000;
        --secondary-color: #f0f0f0;
        --text-color: #000000;
        --line-color: #999999;
    }

    body {
        margin: 0;
        padding: 0;
        font-family: 'Montserrat', sans-serif;
        background-color: #555;
        color: var(--text-color);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .page {
        width: 210mm;
        height: 297mm;
        padding: 15mm 20mm;
        margin: 10mm auto;
        background: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        box-sizing: border-box;
        page-break-after: always;
        position: relative;
        overflow: hidden;
    }

    .cover {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        height: 100%;
        border: 4px solid var(--primary-color);
        padding: 20mm;
        box-sizing: border-box;
    }

    .cover h1 {
        font-family: 'Dancing Script', cursive;
        font-size: 65pt;
        color: var(--primary-color);
        margin: 0;
    }

    .cover h2 {
        font-weight: 400;
        font-size: 20pt;
        letter-spacing: 5px;
        margin-top: 10px;
        color: #333;
    }

    .cover p {
        margin-top: auto;
        font-size: 14pt;
        color: #666;
    }

    .day-block {
        height: 130mm; /* Metade da página, aproximadamente */
        display: flex;
        flex-direction: column;
        border-bottom: 2px dashed var(--primary-color);
        padding-bottom: 5mm;
        margin-bottom: 5mm;
        box-sizing: border-box;
    }

    .day-block.last-on-page {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
        height: 135mm;
    }

    .date-header {
        background-color: var(--secondary-color);
        padding: 10px 15px;
        border: 2px solid var(--primary-color);
        font-size: 14pt;
        font-weight: 600;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 5px;
    }

    .weekday {
        text-transform: capitalize;
        color: var(--primary-color);
    }
    
    .festa-badge {
        background-color: var(--primary-color);
        color: white;
        padding: 3px 10px;
        border-radius: 15px;
        font-size: 10pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .field-row {
        display: flex;
        margin-bottom: 10px;
        align-items: flex-end;
    }

    .field-label {
        font-weight: 600;
        margin-right: 10px;
        white-space: nowrap;
        font-size: 11pt;
    }

    .field-line {
        flex-grow: 1;
        border-bottom: 2px solid var(--line-color);
    }

    .obs-section {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        margin-top: 5px;
    }

    .obs-title {
        font-weight: 600;
        margin-bottom: 5px;
        font-size: 11pt;
    }

    .obs-lines {
        flex-grow: 1;
        background-image: linear-gradient(var(--line-color) 1px, transparent 1px);
        background-size: 100% 30px; /* Linhas levemente mais próximas para caber bem, mas confortáveis */
        background-position: 0 29px;
    }

    @media print {
        body {
            background-color: white;
        }
        .page {
            margin: 0;
            box-shadow: none;
        }
        @page {
            size: A4 portrait;
            margin: 0;
        }
    }
</style>
</head>
<body>

<div class="page">
    <div class="cover">
        <h1>Agenda de Festas</h1>
        <h2>2026 - 2027</h2>
        <p>Setembro 2026 a Fevereiro 2027 (Semestre 1)</p>
        <p style="font-size: 10pt; color: #666; margin-top: 10px;">Exclusivo para Sextas, Sábados e Domingos</p>
    </div>
</div>
"""

def translate_weekday(wd):
    mapping = {
        4: "Sexta-feira",
        5: "Sábado",
        6: "Domingo"
    }
    return mapping[wd]

def translate_month(m):
    mapping = {
        1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
        7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
    }
    return mapping[m]

pages_html = ""
total_pages = 1 # Cover is page 1

for d in days:
    total_pages += 1
    weekday_str = translate_weekday(d.weekday())
    date_str = f"{d.day:02d} de {translate_month(d.month)} de {d.year}"
    
    # Block 1 - Festa 1
    pages_html += f'''<div class="page">
    <div class="day-block">
        <div class="date-header">
            <div>
                <span class="weekday">{weekday_str}</span>, 
                <span class="date">{date_str}</span>
            </div>
            <span class="festa-badge">Festa 1</span>
        </div>
        
        <div class="field-row">
            <span class="field-label">Nome do Cliente / Festa:</span>
            <div class="field-line"></div>
        </div>
        
        <div class="field-row">
            <span class="field-label">Contato / WhatsApp:</span>
            <div class="field-line"></div>
        </div>
        
        <div class="field-row">
            <span class="field-label">Endereço e Nº:</span>
            <div class="field-line"></div>
        </div>
        
        <div class="field-row">
            <div style="flex: 0 0 300px; display: flex; align-items: flex-end;">
                <span class="field-label">Valor: R$</span>
                <div class="field-line"></div>
            </div>
            <div style="flex: 1; display: flex; align-items: flex-end; margin-left: 20px;">
                <div class="field-line"></div>
            </div>
        </div>
        
        <div class="obs-section">
            <div class="obs-title">Observações:</div>
            <div class="obs-lines"></div>
        </div>
    </div>\n'''

    # Block 2 - Festa 2
    pages_html += f'''    <div class="day-block last-on-page">
        <div class="date-header">
            <div>
                <span class="weekday">{weekday_str}</span>, 
                <span class="date">{date_str}</span>
            </div>
            <span class="festa-badge">Festa 2</span>
        </div>
        
        <div class="field-row">
            <span class="field-label">Nome do Cliente / Festa:</span>
            <div class="field-line"></div>
        </div>
        
        <div class="field-row">
            <span class="field-label">Contato / WhatsApp:</span>
            <div class="field-line"></div>
        </div>
        
        <div class="field-row">
            <span class="field-label">Endereço e Nº:</span>
            <div class="field-line"></div>
        </div>
        
        <div class="field-row">
            <div style="flex: 0 0 300px; display: flex; align-items: flex-end;">
                <span class="field-label">Valor: R$</span>
                <div class="field-line"></div>
            </div>
            <div style="flex: 1; display: flex; align-items: flex-end; margin-left: 20px;">
                <div class="field-line"></div>
            </div>
        </div>
        
        <div class="obs-section">
            <div class="obs-title">Observações:</div>
            <div class="obs-lines"></div>
        </div>
    </div>
</div>\n'''

html_content += pages_html
html_content += """</body>
</html>
"""

with open("Agenda_Festas.html", "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Agenda generated for B&W. Total pages: {total_pages}")
