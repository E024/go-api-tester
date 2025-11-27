//go:build !windows

package main

import (
	"os/exec"
	"runtime"
	"log"
	"fmt"
)

func runTray(url string) {
	// 非 Windows 系统直接打开浏览器并阻塞主线程
	openBrowser(url)
	
	// 阻塞主线程，防止程序退出
	select {}
}

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	}
	if err != nil {
		log.Printf("Warning: Failed to open browser: %v", err)
	}
}