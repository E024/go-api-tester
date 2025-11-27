//go:build windows

package main

import (
	"github.com/getlantern/systray"
	"os/exec"
	_ "embed"
)

//go:embed tray_icon128.ico
var iconData []byte

func runTray(url string) {
	onReady := func() {
		systray.SetIcon(iconData)
		systray.SetTitle("Go API Tester")
		systray.SetTooltip("Go API Tester - Running")

		// 菜单项：打开 Web 界面
		mOpen := systray.AddMenuItem("Open Dashboard", "Open the web interface")
		mOpen.SetIcon(iconData) // 复用图标

		systray.AddSeparator()

		// 菜单项：退出
		mQuit := systray.AddMenuItem("Quit", "Stop the server and exit")

		// 第一次启动自动打开浏览器
		openBrowser(url)

		// 事件监听循环
		go func() {
			for {
				select {
				case <-mOpen.ClickedCh:
					openBrowser(url)
				case <-mQuit.ClickedCh:
					systray.Quit()
				}
			}
		}()
	}

	onExit := func() {
		// 清理工作（如果有）
	}

	// systray.Run 必须在 main 线程调用，且会阻塞
	systray.Run(onReady, onExit)
}

func openBrowser(url string) {
	exec.Command("cmd", "/c", "start", url).Start()
}