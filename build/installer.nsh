; DeepSeek Harness GUI — custom NSIS include
; Included by electron-builder before the installer pages are defined,
; so MUI_TEXT_* defines here override the install-page texts.

!define MUI_TEXT_INSTALLING_TITLE "正在安装 DeepSeek Harness GUI"
!define MUI_TEXT_INSTALLING_SUBTITLE "内置完整运行环境（上万个依赖文件），解压需要几分钟，进度条可能长时间不动——这是正常现象，请勿点击取消。"

; Show the extraction log while files are being installed so the user can
; see real activity. ShowInstDetails is root-level only and not usable
; here; SetDetailsView is the section-valid equivalent.
!macro customInstall
  SetDetailsView show
  DetailPrint "正在解压内置运行环境（文件较多，请耐心等待）…"
!macroend
