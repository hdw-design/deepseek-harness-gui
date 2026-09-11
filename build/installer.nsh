; DeepSeek Harness GUI — custom NSIS include
; Included by electron-builder into the shared header, which is prepended to
; the installer template, so MUI_TEXT_* defines here override the install-page
; texts and customPageAfterChangeDir can register an extra page.
;
; The page functions deliberately live INSIDE customPageAfterChangeDir: this
; file is processed before the template includes MUI2.nsh, so an
; !insertmacro MUI_HEADER_TEXT at header level would not resolve. The
; expansion point (assistedInstaller.nsh, after MUI2) works — and because that
; hook only runs in the installer pass, the NSIS variables below never show up
; as unused during the uninstaller pass (warning 6001, which electron-builder
; turns into a build error).

!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!define MUI_TEXT_INSTALLING_TITLE "正在安装 DeepSeek Harness GUI"
!define MUI_TEXT_INSTALLING_SUBTITLE "内置完整运行环境（上万个依赖文件），解压需要几分钟，进度条可能长时间不动——这是正常现象，请勿点击取消。"

; ---------------------------------------------------------------------------
; Optional page (assisted installer only): add the bundled runtime to the
; Windows Defender exclusion list.
;
; The bundled runtime is ~10.5k small files. With real-time scanning enabled a
; cold start costs 15-18 s; with the install directory excluded it drops to
; ~5 s (measured on the reference machine).
; ---------------------------------------------------------------------------
!macro customPageAfterChangeDir
  !define DSH_DEFENDER_PAGE

  Var DshDefenderCheckbox
  Var DshDefenderState

  Function dshDefenderPageCreate
    !insertmacro MUI_HEADER_TEXT "启动加速" "把内置运行环境加入 Windows Defender 排除列表。"

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 0 100% 12u "把安装目录加入 Windows Defender 排除列表（推荐）"
    Pop $DshDefenderCheckbox
    ${NSD_Check} $DshDefenderCheckbox

    ${NSD_CreateLabel} 0 22u 100% 110u "内置运行环境有 1 万多个文件，Defender 的实时扫描会拖慢每次启动（实测冷启动 15~18 秒 → 约 5 秒）。$\r$\n$\r$\n勾选后安装程序会执行一次 Add-MpPreference，仅把本程序的安装目录和当前用户的 .dsh\profiles 排除在实时扫描之外，不影响其它位置；卸载时会自动移除。$\r$\n$\r$\n使用第三方杀毒软件时此项无效，可取消勾选。"
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function dshDefenderPageLeave
    ${NSD_GetState} $DshDefenderCheckbox $DshDefenderState
  FunctionEnd

  Page custom dshDefenderPageCreate dshDefenderPageLeave
!macroend

; ---------------------------------------------------------------------------
; Add / remove the Defender exclusions. The paths travel through environment
; variables so that spaces in them need no quoting gymnastics.
; ---------------------------------------------------------------------------
!macro dshDefenderCall _action
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("DSH_EXCL_INSTALL", "$INSTDIR").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("DSH_EXCL_PROFILE", "$PROFILE\.dsh\profiles").r0'
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "${_action} -ExclusionPath $$env:DSH_EXCL_INSTALL, $$env:DSH_EXCL_PROFILE -ErrorAction SilentlyContinue"'
  Pop $0
!macroend

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

  ; A silent install (electron-updater's silent update, or /S) never runs the
  ; page above, so its leave function never runs and $DshDefenderState stays
  ; empty — the exclusion then keeps whatever the first install chose.
  !ifdef DSH_DEFENDER_PAGE
    ${If} $DshDefenderState == ${BST_CHECKED}
      DetailPrint "正在把安装目录加入 Windows Defender 排除列表…"
      !insertmacro dshDefenderCall "Add-MpPreference"
      ${If} $0 == 0
        DetailPrint "已加入 Windows Defender 排除列表。"
      ${Else}
        DetailPrint "未能加入 Defender 排除列表（返回码 $0）——可稍后手动添加，不影响使用。"
      ${EndIf}
    ${EndIf}
  !endif
!macroend

!macro customUnInstall
  !insertmacro removeStaleDesktopShortcuts

  ; electron-builder runs the old uninstaller as part of an update. Removing
  ; the exclusion there would silently undo the user's choice on every
  ; auto-update, so only do it for a real uninstall.
  ${IfNot} ${isUpdated}
    DetailPrint "正在移除 Windows Defender 排除项…"
    !insertmacro dshDefenderCall "Remove-MpPreference"
  ${EndIf}
!macroend
