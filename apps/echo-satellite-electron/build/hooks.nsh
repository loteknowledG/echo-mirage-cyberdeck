; Echo Satellite NSIS hooks — quiet in-place upgrades on Windows.
; Included before MUI finish-page constants in Tauri's installer.nsi.

!include "LogicLib.nsh"

; Do not auto-launch or auto-create shortcuts on the finish page.
; User opens Echo Satellite from Start menu after install completes.
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED

!macro SatelliteCloseForUpgrade
  Push $0
  Push $1
  StrCpy $1 0
  satellite_close_retry:
    !if "${INSTALLMODE}" == "currentUser"
      nsis_tauri_utils::FindProcessCurrentUser "${MAINBINARYNAME}.exe"
    !else
      nsis_tauri_utils::FindProcess "${MAINBINARYNAME}.exe"
    !endif
    Pop $0
    ${If} $0 != 0
      Goto satellite_close_done
    ${EndIf}
    ${If} $1 >= 4
      Goto satellite_close_done
    ${EndIf}
    IntOp $1 $1 + 1
    DetailPrint "Closing Echo Satellite for upgrade ($1/4)…"
    !if "${INSTALLMODE}" == "currentUser"
      nsis_tauri_utils::KillProcessCurrentUser "${MAINBINARYNAME}.exe"
    !else
      nsis_tauri_utils::KillProcess "${MAINBINARYNAME}.exe"
    !endif
    Pop $0
    Sleep 1500
    Goto satellite_close_retry
  satellite_close_done:
  Pop $1
  Pop $0
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro SatelliteCloseForUpgrade
!macroend
