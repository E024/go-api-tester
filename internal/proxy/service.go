package proxy

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

// SendRequest 执行实际的 HTTP 请求
func SendRequest(req ProxyRequest) ProxyResponse {
	// 1. URL & Params 处理
	targetURL := req.URL
	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		targetURL = "http://" + targetURL
	}
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return ProxyResponse{Error: "Invalid URL: " + err.Error()}
	}
	query := parsedURL.Query()
	for _, p := range req.Params {
		if p.Enabled && p.Key != "" {
			query.Add(p.Key, p.Value)
		}
	}
	parsedURL.RawQuery = query.Encode()
	finalURL := parsedURL.String()

	// 2. Body 处理
	var bodyReader io.Reader
	contentType := ""
	switch req.BodyType {
	case "raw":
		bodyReader = strings.NewReader(req.RawBody)
	case "x-www-form-urlencoded":
		data := url.Values{}
		for _, item := range req.UrlEncoded {
			if item.Enabled && item.Key != "" {
				data.Add(item.Key, item.Value)
			}
		}
		bodyReader = strings.NewReader(data.Encode())
		contentType = "application/x-www-form-urlencoded"
	case "form-data":
		bodyBuf := &bytes.Buffer{}
		writer := multipart.NewWriter(bodyBuf)
		for _, item := range req.FormData {
			if item.Enabled && item.Key != "" {
				if item.Type == "file" {
					w, _ := writer.CreateFormFile(item.Key, "test.bin")
					w.Write([]byte("[File Upload]"))
				} else {
					writer.WriteField(item.Key, item.Value)
				}
			}
		}
		writer.Close()
		bodyReader = bodyBuf
		contentType = writer.FormDataContentType()
	case "none":
		bodyReader = nil
	default:
		bodyReader = strings.NewReader(req.RawBody)
	}

	// 3. 创建请求
	goReq, err := http.NewRequest(req.Method, finalURL, bodyReader)
	if err != nil {
		return ProxyResponse{Error: "Create Request Failed: " + err.Error()}
	}
	if contentType != "" {
		goReq.Header.Set("Content-Type", contentType)
	}
	for _, h := range req.Headers {
		if h.Enabled && h.Key != "" {
			goReq.Header.Set(h.Key, h.Value)
		}
	}
	
	// 移除 Accept-Encoding，让 Transport 自动处理 Content-Encoding: gzip
	// 但如果服务器返回的是 application/x-gzip 文件流，Transport 不会解压，需要我们在 readResponseBody 处理
	goReq.Header.Del("Accept-Encoding")

	// 4. Auth
	switch req.Auth.Type {
	case "basic":
		auth := req.Auth.Basic["username"] + ":" + req.Auth.Basic["password"]
		goReq.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(auth)))
	case "bearer":
		goReq.Header.Set("Authorization", "Bearer "+req.Auth.Bearer["token"])
	}

	// 5. 发送
	client := &http.Client{Timeout: 60 * time.Second}
	startTime := time.Now()
	resp, err := client.Do(goReq)
	duration := time.Since(startTime)

	if err != nil {
		return handleError(err, duration)
	}
	defer resp.Body.Close()

	// 6. 读取并智能处理响应
	bodyStr, isBinary, readErr := readAndProcessBody(resp)
	if readErr != nil {
		return ProxyResponse{
			StatusCode: resp.StatusCode,
			TimeMs:     duration.Milliseconds(),
			Error:      fmt.Sprintf("Read Body Failed: %v", readErr),
		}
	}

	return ProxyResponse{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header,
		Body:       bodyStr,
		IsBinary:   isBinary, // 前端根据此字段决定是否显示 Hex/Image 视图
		TimeMs:     duration.Milliseconds(),
	}
}

// readAndProcessBody 读取 Body，尝试解压，并判断是否为文本
func readAndProcessBody(resp *http.Response) (string, bool, error) {
	// 1. 读取所有原始字节
	// 限制 10MB
	const maxLimit = 10 * 1024 * 1024
	rawBytes, err := io.ReadAll(io.LimitReader(resp.Body, maxLimit))
	if err != nil {
		return "", false, err
	}

	// 2. 尝试 GZIP 解压 (即使 Go 已经自动处理了 Content-Encoding，
	// 但有时服务器返回 Content-Type: application/x-gzip 而没有 Encoding 头)
	// Gzip 魔数: 1f 8b
	contentBytes := rawBytes
	if len(rawBytes) > 2 && rawBytes[0] == 0x1f && rawBytes[1] == 0x8b {
		gzipReader, err := gzip.NewReader(bytes.NewReader(rawBytes))
		if err == nil {
			decompressed, err := io.ReadAll(gzipReader)
			if err == nil {
				// 解压成功，使用解压后的数据
				contentBytes = decompressed
				gzipReader.Close()
			}
		}
	}

	// 3. 内容嗅探：判断是文本还是二进制
	// 我们不完全信任 Content-Type，而是检测内容是否为有效 UTF-8 且无可打印字符过少的情况
	isBinary := !isPlainText(contentBytes)

	// 4. 返回结果
	if isBinary {
		// 二进制返回 Base64
		return base64.StdEncoding.EncodeToString(contentBytes), true, nil
	} else {
		// 文本直接返回字符串
		return string(contentBytes), false, nil
	}
}

// isPlainText 简单判断字节流是否像文本
func isPlainText(b []byte) bool {
	// 如果包含 NULL 字节 (0x00)，通常是二进制 (除非是 UTF-16，但这里简化处理)
	if bytes.IndexByte(b, 0x00) != -1 {
		return false
	}
	// 必须是有效的 UTF-8
	if !utf8.Valid(b) {
		return false
	}
	// 进一步可以检查控制字符比例，但 utf8.Valid 通常够用了
	return true
}

func handleError(err error, duration time.Duration) ProxyResponse {
	resp := ProxyResponse{
		TimeMs: duration.Milliseconds(),
	}
	if urlErr, ok := err.(*url.Error); ok {
		if urlErr.Timeout() {
			resp.Error = "请求超时 (Timeout)"
			return resp
		}
		if netErr, ok := urlErr.Err.(net.Error); ok && netErr.Timeout() {
			resp.Error = "网络连接超时"
			return resp
		}
		errStr := urlErr.Err.Error()
		if strings.Contains(errStr, "connection refused") {
			resp.Error = "连接被拒绝 (Connection Refused)"
			return resp
		}
		if strings.Contains(errStr, "no such host") {
			resp.Error = "DNS 解析失败 (No Such Host)"
			return resp
		}
	}
	resp.Error = fmt.Sprintf("网络请求错误: %v", err)
	return resp
}