# Convierte un .docx o .pptx a PDF con Microsoft Word / PowerPoint (COM).
# Uso: powershell -File docs\docx_a_pdf.ps1 <entrada> <salida.pdf>
param([string]$Entrada, [string]$Salida)
$Entrada = (Resolve-Path $Entrada).Path
$Salida = [System.IO.Path]::GetFullPath($Salida)
if ($Entrada -like "*.pptx") {
  $app = New-Object -ComObject PowerPoint.Application
  $p = $app.Presentations.Open($Entrada, $true, $false, $false)
  $p.SaveAs($Salida, 32)   # ppSaveAsPDF
  $p.Close(); $app.Quit()
} else {
  $app = New-Object -ComObject Word.Application
  $app.Visible = $false
  $d = $app.Documents.Open($Entrada, $false, $true)
  $d.SaveAs2($Salida, 17)  # wdFormatPDF
  "paginas: " + $d.ComputeStatistics(2)
  $d.Close($false); $app.Quit()
}
"pdf: $Salida"
