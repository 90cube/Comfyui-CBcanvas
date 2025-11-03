# Bug Fix - TypeError: Cannot read properties of undefined

## 문제

```
TypeError: Cannot read properties of undefined (reading 'ratio')
```

## 원인

`ASPECT_RATIOS` 객체에서 값을 찾을 때 키가 일치하지 않아 `undefined`를 반환하고, 이후 `.ratio`에 접근하려 할 때 에러 발생.

### 근본 원인
1. `ASPECT_RATIOS` 키는 문자열: `"-6"`, `"0"`, `"6"` 등
2. `aspectRatioWidget.value`가 숫자로 전달될 수 있음
3. 일부 코드에서 `String()` 변환 누락
4. Fallback 처리 부족

## 해결 방법

### 1. 안전한 헬퍼 함수 추가

```javascript
/**
 * Get aspect ratio info safely
 */
function getAspectRatioInfo(value) {
    const key = String(value);
    const info = ASPECT_RATIOS[key];

    if (!info) {
        console.warn(`CBCanvas: Invalid aspect ratio value ${value} (key: ${key}), using default 1:1`);
        return ASPECT_RATIOS["0"];
    }

    return info;
}
```

### 2. 모든 ASPECT_RATIOS 접근 수정

**수정 전:**
```javascript
const ratioInfo = ASPECT_RATIOS[String(initialRatio)];
```

**수정 후:**
```javascript
const ratioInfo = getAspectRatioInfo(initialRatio);
```

### 3. 수정된 위치

- **Line 324**: 노드 생성 시 초기 비율
- **Line 410**: 슬라이더 변경 시 비율 업데이트
- **Line 291**: 리사이즈 시 라벨 업데이트

## 테스트

### 정상 케이스
```javascript
getAspectRatioInfo(0)   // ✅ { ratio: "1:1", width: 1024, height: 1024 }
getAspectRatioInfo(-6)  // ✅ { ratio: "21:9", width: 1536, height: 640 }
getAspectRatioInfo(6)   // ✅ { ratio: "9:21", width: 640, height: 1536 }
```

### 에러 케이스 (이제 안전함)
```javascript
getAspectRatioInfo(undefined)  // ⚠️ Warning → 1:1 반환
getAspectRatioInfo(null)       // ⚠️ Warning → 1:1 반환
getAspectRatioInfo(100)        // ⚠️ Warning → 1:1 반환
getAspectRatioInfo("invalid")  // ⚠️ Warning → 1:1 반환
```

## 디버깅 정보

### 콘솔 메시지

**정상 작동:**
```
CBCanvas Enhanced: Creating with ratio 1:1 (value: 0)
CBCanvas Enhanced: Updating to 16:9 (value: -4)
```

**경고 (비정상 값):**
```
CBCanvas: Invalid aspect ratio value undefined (key: undefined), using default 1:1
```

## 추가 개선

### 타입 안정성
```javascript
// 슬라이더 위젯 값이 항상 정수인지 확인
const initialRatio = parseInt(aspectRatioWidget?.value ?? 0);
```

### 범위 체크
```javascript
// 슬라이더 범위 검증 (-6 ~ 6)
function getAspectRatioInfo(value) {
    const numValue = Number(value);
    if (numValue < -6 || numValue > 6) {
        console.warn(`CBCanvas: Value ${value} out of range [-6, 6], using 0`);
        return ASPECT_RATIOS["0"];
    }
    // ...
}
```

## 재현 방법 (수정 전)

1. 노드 생성 시 `aspectRatioWidget`가 undefined
2. 또는 슬라이더 값이 예상과 다른 타입
3. `ASPECT_RATIOS[undefined]` → undefined
4. `undefined.ratio` → TypeError

## 해결 확인

✅ 모든 ASPECT_RATIOS 접근에 안전장치 추가
✅ Fallback 값으로 1:1 비율 사용
✅ 디버깅을 위한 경고 메시지 출력
✅ 타입 변환 명시적 처리

## 버전

- **Fixed in**: v1.0.2
- **Date**: 2025-01-03
- **File**: `js/cbcanvas_node.js`
