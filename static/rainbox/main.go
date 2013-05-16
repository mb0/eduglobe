package main

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
)

func main() {
	w, h := 2048, 1024
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := 0; x < w; x++ {
		for y := 0; y < h; y++ {
			img.SetRGBA(x, y, color.RGBA{
				uint8(x + 1),
				uint8(h - y),
				uint8((x+1)>>8)<<4 | uint8((h-y)>>8),
				0xff,
			})
		}
	}
	fn := fmt.Sprintf("rainbox_%dx%d.png", w, h)
	f, err := os.Create(fn)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	err = png.Encode(f, img)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	fmt.Printf("wrote %s\n", fn)
}
