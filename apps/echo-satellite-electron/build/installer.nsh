; Close running Echo Satellite before upgrade install.
!macro customInit
  nsExec::Exec 'taskkill /F /IM "Echo-Satellite.exe" /T'
!macroend
