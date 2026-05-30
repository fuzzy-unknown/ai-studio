fetch("http://localhost:5173/api/image/generate", {
  "headers": {
    "accept": "*/*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "content-type": "application/json",
    "sec-ch-ua": "\"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "cookie": "dashscope_studio_session=6wIRGdbKr_ysZDBMKTQ2AEt3f_zZx5PSMtkMSIl-Y9w",
    "Referer": "http://localhost:5173/"
  },
  "body": "{\"prompt\":\"Use the uploaded character as a reference, generate a professional character three-view setting reference sheet. The composition completely references the reference image, divided into left and right parts, the left side is the front, side, and back full-body three-view, the right side is multi-angle facial close-ups, clothing texture details, accessory close-ups, and color palette. Keep the character's facial features, hairstyle, and outfit completely consistent, maintain a hyper-realistic texture, cinematic soft lighting and shadows, pure white background, clean image, standardized layout.\",\"model\":\"qwen-image-2.0-pro\",\"imageUrls\":[\"https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3279833771/p1058430.webp\"],\"resolution\":\"2048*2048\",\"size\":\"2048*2048\",\"n\":1,\"promptExtend\":true,\"watermark\":false}",
  "method": "POST"
});

{
    "task_id": "sync-1780144714607-q6km90",
    "status": "SUCCEEDED"
}

/// =================================

fetch("http://localhost:5173/api/video/usage/stats", {
  "headers": {
    "accept": "*/*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "sec-ch-ua": "\"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "cookie": "dashscope_studio_session=6wIRGdbKr_ysZDBMKTQ2AEt3f_zZx5PSMtkMSIl-Y9w",
    "Referer": "http://localhost:5173/"
  },
  "body": null,
  "method": "GET"
});

{"error":"Validation Error","details":["Expected number"]}