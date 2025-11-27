package proxy

type KeyValue struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
	Type    string `json:"type,omitempty"`
}

type ProxyRequest struct {
	Method      string      `json:"method"`
	URL         string      `json:"url"`
	Params      []KeyValue  `json:"params"`
	Headers     []KeyValue  `json:"headers"`
	Auth        AuthConfig  `json:"auth"`
	BodyType    string      `json:"body_type"`
	RawBody     string      `json:"raw_body"`
	FormData    []KeyValue  `json:"form_data"`
	UrlEncoded  []KeyValue  `json:"url_encoded"`
}

type AuthConfig struct {
	Type   string            `json:"type"` 
	Basic  map[string]string `json:"basic"`
	Bearer map[string]string `json:"bearer"`
}

type ProxyResponse struct {
	StatusCode  int                 `json:"status"`
	Headers     map[string][]string `json:"headers"`
	Body        string              `json:"body"`    // 如果是二进制，这里是 Base64 字符串
	IsBinary    bool                `json:"is_binary"` // 新增：标记是否为二进制
	TimeMs      int64               `json:"time_ms"`
	Error       string              `json:"error,omitempty"`
}