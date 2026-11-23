// ============================================================
// GRUBIG ERP - 카카오맵 불러오기 · 주소 → 좌표 (편직처 기계 현황 지도 — 대표님 요청 2026-11-23)
//  · 키 = 카카오 개발자 사이트 앱의 'JavaScript 키' (회사 설정 settings/general.kakaoMapKey — 화면에서 넣음)
//    JavaScript 키는 원래 웹페이지에 보이는 키라 숨길 필요 없음. 등록한 도메인(우리 주소)에서만 작동
//  · 지도 SDK는 처음 쓸 때 한 번만 불러옴 (libraries=services — 주소 검색 · 장소 검색)
//  · 브라우저 전용 (Node에서 부르지 말 것)
// ============================================================

import { geocodeQuery } from './knitFactoryModel';

let loadPromise = null;
let loadedKey = null;
const LOAD_TIMEOUT_MS = 12000;

/** 카카오맵 SDK 불러오기 → window.kakao. 키·도메인이 틀리면 실패(시간 초과) */
export const loadKakaoMaps = (appKey) => {
  const key = String(appKey || '').trim();
  if (!key) return Promise.reject(new Error('카카오맵 키가 없어요.'));
  if (loadedKey && loadedKey !== key) {
    return Promise.reject(new Error('카카오맵 키를 바꿨어요. 새로고침(F5) 후 다시 열어 주세요.'));
  }
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao);
  if (loadPromise) return loadPromise;
  loadedKey = key;
  loadPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('카카오맵을 불러오지 못했어요. 키와 등록한 도메인(사이트 주소)을 확인해 주세요.')), LOAD_TIMEOUT_MS);
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      try {
        window.kakao.maps.load(() => { clearTimeout(timer); resolve(window.kakao); });
      } catch (e) {
        clearTimeout(timer);
        reject(new Error(`카카오맵을 불러오지 못했어요: ${e?.message || e}`));
      }
    };
    // 키가 틀리거나 도메인이 등록 안 됐으면 카카오가 오류(401 등)로 답해서 여기로 옴 (인터넷이 끊겨도)
    script.onerror = () => { clearTimeout(timer); reject(new Error('카카오맵을 불러오지 못했어요. JavaScript 키가 맞는지, 사이트 주소(도메인) 3개를 등록했는지, 카카오맵 사용이 ON인지 확인해 주세요.')); };
    document.head.appendChild(script);
  }).catch(e => {
    loadPromise = null;
    loadedKey = null;
    throw e;
  });
  return loadPromise;
};

const addressSearch = (kakao, query) => new Promise(resolve => {
  if (!query) { resolve(null); return; }
  const geocoder = new kakao.maps.services.Geocoder();
  geocoder.addressSearch(query, (result, status) => {
    if (status === kakao.maps.services.Status.OK && result?.[0]) resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
    else resolve(null);
  });
});
const keywordSearch = (kakao, query) => new Promise(resolve => {
  if (!query) { resolve(null); return; }
  const places = new kakao.maps.services.Places();
  places.keywordSearch(query, (result, status) => {
    if (status === kakao.maps.services.Status.OK && result?.[0]) resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
    else resolve(null);
  });
});

/**
 * 편직처 대표 주소 → 좌표 { lat, lng, address(찾은 주소 = 대표 주소), manual: false } | null
 *  1) 주소 검색 (시·군이 없으면 지역을 앞에 붙임) 2) 못 찾으면 '지역 + 편직처 이름'으로 장소 검색
 */
export const geocodeFactory = async (appKey, factory) => {
  const address = String((factory?.addresses || [])[0] || '').trim();
  if (!address) return null;
  const kakao = await loadKakaoMaps(appKey);
  const byAddress = await addressSearch(kakao, geocodeQuery(factory)) || await addressSearch(kakao, address);
  if (byAddress) return { ...byAddress, address, manual: false };
  // 주소로 못 찾으면 이름으로 — 다른 곳일 수 있어서 '이름으로 찾음' 표시 (지도에서 확인 · 직접 찍기)
  const byName = await keywordSearch(kakao, `${factory.region || ''} ${factory.name}`.trim());
  return byName ? { ...byName, address, manual: false, byName: true } : null;
};
