; DeepSeek Harness GUI — custom NSIS include
; Included by electron-builder before the installer pages are defined,
; so MUI_TEXT_* defines here override the install-page texts.

!define MUI_TEXT_INSTALLING_TITLE "正在安装 DeepSeek Harness GUI"
!define MUI_TEXT_INSTALLING_SUBTITLE "内置完整运行环境（上万个依赖文件），解压需要几分钟，进度条可能长时间不动——这是正常现象，请勿点击取消。"

; Clean up stray desktop shortcuts from previous installs/updates,
; regardless of whether they were created for the current user or all users.
; electron-builder's default uninstaller only removes the shortcut matching
; the previous install scope, so scope switches can leave orphans behind.
!macro removeStaleDesktopShortcuts
  SetShellVarContext all
  Delete "$DESKTOP\DeepSeek Harness GUI.lnk"
  Delete "$DESKTOP\DeepSeekHarnessGUI.lnk"
  SetShellVarContext current
  Delete "$DESKTOP\DeepSeek Harness GUI.lnk"
  Delete "$DESKTOP\DeepSeekHarnessGUI.lnk"
!macroend

!macro customInstall
  SetDetailsView show
  DetailPrint "正在解压内置运行环境（文件较多，请耐心等待）…"
!macroend

!macro customUnInstall
  !insertmacro removeStaleDesktopShortcuts
!macroend
