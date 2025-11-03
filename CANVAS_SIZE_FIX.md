# Canvas Size Fix - 여백과 캔버스 크기 불일치 해결

## 🐛 문제

스크린샷과 같이 캔버스가 작게 표시되고 주변에 회색 여백이 크게 남는 문제.

### 증상
- 흰색 캔버스가 왼쪽 상단에 작게 표시
- 나머지 영역은 회색 배경
- 실제 캔버스 크기(1024×1024)와 표시 크기(500×500)가 불일치

## 🔍 원인

Fabric.js는 3개의 DOM 요소를 사용:
```
.canvas-container (wrapperEl)
  ├── canvas.lower-canvas (lowerCanvasEl)
  └── canvas.upper-canvas (upperCanvasEl)
```

**문제**: `wrapperEl`의 크기를 설정하지 않아서 원본 크기(1024×1024)로 유지됨
- lowerCanvasEl, upperCanvasEl만 CSS로 축소 (500×500)
- wrapperEl은 1024×1024 그대로 → 회색 여백 발생

## ✅ 해결 방법

### 1. JavaScript 수정 (cbcanvas_node.js)

#### 노드 생성 시
```javascript
// 수정 전
this.fabricCanvas.lowerCanvasEl.style.width = displayWidth + "px";
this.fabricCanvas.lowerCanvasEl.style.height = displayHeight + "px";
this.fabricCanvas.upperCanvasEl.style.width = displayWidth + "px";
this.fabricCanvas.upperCanvasEl.style.height = displayHeight + "px";

// 수정 후
// Set wrapper size (important!)
this.fabricCanvas.wrapperEl.style.width = displayWidth + "px";
this.fabricCanvas.wrapperEl.style.height = displayHeight + "px";

// Set canvas element sizes
this.fabricCanvas.lowerCanvasEl.style.width = displayWidth + "px";
this.fabricCanvas.lowerCanvasEl.style.height = displayHeight + "px";
this.fabricCanvas.upperCanvasEl.style.width = displayWidth + "px";
this.fabricCanvas.upperCanvasEl.style.height = displayHeight + "px";
```

#### 리사이즈 시
```javascript
function resizeCanvas(node, width, height) {
    const canvas = node.fabricCanvas;

    // Calculate display size
    const { displayWidth, displayHeight } = calculateDisplaySize(width, height, MAX_DISPLAY_SIZE);

    // Set wrapper size (important!)
    canvas.wrapperEl.style.width = displayWidth + "px";
    canvas.wrapperEl.style.height = displayHeight + "px";

    // Set canvas element sizes
    canvas.lowerCanvasEl.style.width = displayWidth + "px";
    canvas.lowerCanvasEl.style.height = displayHeight + "px";
    canvas.upperCanvasEl.style.width = displayWidth + "px";
    canvas.upperCanvasEl.style.height = displayHeight + "px";
}
```

### 2. CSS 수정 (cbcanvas_node.css)

#### Canvas wrapper 개선
```css
/* Canvas wrapper */
.cbcanvas-canvas-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #3a3a3a;
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 10px;
    overflow: hidden;  /* ✅ 추가: 넘치는 부분 숨기기 */
}

/* Fabric.js canvas container */
.cbcanvas-canvas-wrapper .canvas-container {
    margin: 0 !important;  /* ✅ 추가: 여백 제거 */
}
```

#### 강제 크기 제한
```css
/* Fabric.js canvas container - force proper sizing */
.cbcanvas-enhanced-container .canvas-container {
    margin: 0 !important;
    position: relative !important;
}

/* Prevent wrapper overflow */
.cbcanvas-enhanced-container .canvas-container canvas {
    max-width: 100% !important;
    height: auto !important;
}
```

## 📐 크기 계산 로직

```javascript
// 실제 해상도 (고품질)
width: 1024, height: 1024

// 표시 크기 (노드에 맞게)
displayWidth: 500, displayHeight: 500

// 적용
canvas.width = 1024              // 실제 해상도
canvas.height = 1024             // 실제 해상도
wrapperEl.style.width = "500px"  // 표시 크기 ✅
canvas.style.width = "500px"     // 표시 크기
```

## 🧪 테스트 방법

### 1. 브라우저 캐시 삭제
```
Ctrl + Shift + Delete
→ 캐시 이미지 및 파일 삭제
```

### 2. ComfyUI 완전 재시작
```bash
Ctrl+C로 종료
다시 실행
```

### 3. 노드 추가 후 확인
- 캔버스가 회색 배경 안에 꽉 차게 표시되어야 함
- 주변 여백이 균일해야 함
- 비율 슬라이더 변경 시에도 크기 일치

### 4. 개발자 도구 확인 (F12)
```javascript
// Console에서 확인
const wrapper = document.querySelector('.canvas-container');
console.log('Wrapper:', wrapper.style.width, wrapper.style.height);
// 예상: "500px" "500px"

const canvas = document.querySelector('.lower-canvas');
console.log('Canvas:', canvas.style.width, canvas.style.height);
// 예상: "500px" "500px"
```

## ✅ 수정 확인 체크리스트

- [ ] 흰색 캔버스가 회색 배경을 꽉 채움
- [ ] 주변 여백이 균일함
- [ ] 슬라이더 변경 시 크기 유지
- [ ] 그리기 시 캔버스 영역 정확
- [ ] 이미지 추가 시 캔버스 내에 표시

## 📊 Before & After

### Before (문제)
```
┌─────────────────────────┐
│ ┌──┐                    │ ← 회색 여백
│ │캔│                    │
│ └──┘                    │
│                         │
│         회색 배경        │
└─────────────────────────┘
```

### After (수정)
```
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │                     │ │
│ │      캔버스         │ │
│ │                     │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

## 🔧 추가 최적화

### 반응형 대응
```css
.cbcanvas-canvas-wrapper {
    max-width: 100%;
    width: fit-content;
    margin: 0 auto;
}
```

### 비율별 최적화
```javascript
// 21:9 같은 극단적 비율도 정상 표시
if (width / height > 2) {
    // 와이드 비율
    maxSize = 600;
}
```

## 📝 변경 파일

- ✅ `js/cbcanvas_node.js` - wrapperEl 크기 설정 추가
- ✅ `js/cbcanvas_node.css` - overflow, margin 제어 추가

## 버전

- **Fixed in**: v1.0.3
- **Date**: 2025-01-03
- **Issue**: Canvas size mismatch with wrapper
