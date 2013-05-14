// Copyright 2013 Martin Schnabel. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"fmt"
	"net/http"
)

var dir = "/home/mb0/go/src/github.com/mb0/eduglobe/"

func main() {
	http.HandleFunc("/", func (w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write(index)
	})
	http.Handle("/static/", http.StripPrefix("/static", http.FileServer(http.Dir(dir + "static"))))
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		fmt.Println(err)
	}
}

var index = []byte(`<!DOCTYPE html>
<html>
<head>
<title>eduglobe</title>
</head>
<body>
<script src="static/main.js"></script>
</body>
</html>`)