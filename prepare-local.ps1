$ErrorActionPreference = 'Stop'
$prefix = 'http://127.0.0.1:4173/'
$test = New-Object System.Net.HttpListener
$test.Prefixes.Add($prefix)
try {
  $test.Start()
  $test.Stop()
  exit 0
} catch {
  $test.Close()
  Write-Host 'Windows can cap quyen mo cong local. Se xin quyen mot lan qua hop thoai UAC...'
  $account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $args = @('http','add','urlacl',"url=$prefix","user=$account")
  $grant = Start-Process -FilePath "$env:SystemRoot\System32\netsh.exe" -Verb RunAs -ArgumentList $args -Wait -PassThru
  if ($grant.ExitCode -ne 0) {
    Write-Host 'Khong the cap quyen URL. Hay gui lai anh loi nay.'
    Read-Host 'Nhan Enter de dong'
    exit 1
  }
  Write-Host 'Da cap quyen. Dang tiep tuc khoi dong...'
  exit 0
}
