# debug.ps1

# Appel à GetPrinters et parse le XML en JSON avec xq.exe
$Response = Invoke-WebRequest -Uri "https://127.0.0.1:41951/DYMO/DLS/Printing/GetPrinters" -UseBasicParsing
$Response.Content | .\xq.exe
