import { useState, useEffect, useRef, useCallback } from 'react';

// GRUBIG ERP - 실시간 환율 (원/$, 참고용) — 화면 위 환율 칸 옆 '실시간' (대표님 요청 2026-10-07)
//  · 은행 고시 매매기준율·네이버 환율은 외부 프로그램이 가져가지 못하게 막혀 있어서,
//    무료 환율 서비스의 국제 시장 환율을 받아옴 → 은행 매매기준율과 1~3원쯤 차이 날 수 있는 참고용 숫자
//    (은행 기준율은 NAVER_FX_URL 바로가기로 확인)
//  · 1순위 FXRatesAPI(몇 분마다 갱신) → 안 되면 ExchangeRate-API(하루 1번 갱신)
//  · 10분마다 새로 받아옴 (다른 탭을 보고 있으면 건너뛰고, 돌아왔을 때 10분이 지났으면 받아옴) + refresh()로 바로
//  · 보내는 건 '달러 → 원 환율' 요청뿐 (회사 데이터는 보내지 않음). 공통 환율(내수·수출)은 바꾸지 않음 — 보기만

export const NAVER_FX_URL = 'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW';

const SOURCES = [
  {
    name: 'FXRatesAPI',
    url: 'https://api.fxratesapi.com/latest?base=USD&currencies=KRW',
    parse: (j) => ({ rate: Number(j?.rates?.KRW), at: j?.date ? new Date(j.date) : null }),
  },
  {
    name: 'ExchangeRate-API',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (j) => ({ rate: Number(j?.rates?.KRW), at: j?.time_last_update_unix ? new Date(j.time_last_update_unix * 1000) : null }),
  },
];
const REFRESH_MS = 10 * 60 * 1000; // 10분
const TIMEOUT_MS = 8000;           // 서비스가 응답이 없으면 8초 뒤 다음 서비스로

const fetchJson = async (url) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

/**
 * @returns {{ rate: number|null, at: Date|null, source: string, loading: boolean, error: boolean, checkedAt: Date|null, refresh: Function }}
 *  rate: 원/$ (받아온 적 없으면 null) · at: 그 환율의 기준 시각 · error: 마지막으로 받아오기에 실패함 (rate는 그 전 값 그대로)
 */
export const useMarketRate = () => {
  const [state, setState] = useState({ rate: null, at: null, source: '', loading: false, error: false, checkedAt: null });
  const busyRef = useRef(false);       // 받아오는 중이면 또 부르지 않음 (빠르게 여러 번 눌러도 한 번만)
  const lastCheckRef = useRef(0);      // 마지막으로 받아오려고 한 시각 (ms)

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    lastCheckRef.current = Date.now();
    setState(prev => ({ ...prev, loading: true }));
    try {
      for (const src of SOURCES) {
        try {
          const { rate, at } = src.parse(await fetchJson(src.url));
          if (rate > 0) {
            setState({ rate, at: at && !Number.isNaN(at.getTime()) ? at : null, source: src.name, loading: false, error: false, checkedAt: new Date() });
            return;
          }
        } catch {
          // 이 서비스가 안 되면 다음 서비스로
        }
      }
      setState(prev => ({ ...prev, loading: false, error: true, checkedAt: new Date() }));
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const isVisible = () => document.visibilityState === 'visible';
    const timer = setInterval(() => { if (isVisible()) refresh(); }, REFRESH_MS);
    const onVisible = () => { if (isVisible() && Date.now() - lastCheckRef.current >= REFRESH_MS) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return { ...state, refresh };
};
