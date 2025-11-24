import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Scatter } from 'recharts';
import { Play, Activity, DollarSign, Settings, Search, BookOpen, X, ChevronUp, ChevronDown, Wifi, WifiOff, Loader2, AlertCircle, Terminal, Clipboard, FileJson, Database, BarChart2, TrendingUp, TrendingDown, Zap } from 'lucide-react';

// --- A股 股票代码映射 ---
const STOCK_PROFILES = {
  '600519': { name: '贵州茅台', ts_code: '600519.SH', startPrice: 1800, volatility: 0.015, trend: 0.0002 },
  '300750': { name: '宁德时代', ts_code: '300750.SZ', startPrice: 200, volatility: 0.035, trend: 0.0005 },
  '000001': { name: '平安银行', ts_code: '000001.SZ', startPrice: 15, volatility: 0.02, trend: 0.0001 },
  '601127': { name: '赛力斯', ts_code: '601127.SH', startPrice: 80, volatility: 0.05, trend: 0.001 },
};

// --- 辅助函数 ---
const seededRandom = (seed) => {
  const m = 0x80000000;
  const a = 1103515245;
  const c = 12345;
  let state = seed ? seed : Math.floor(Math.random() * (m - 1));
  return () => {
    state = (a * state + c) % m;
    return state / (m - 1);
  };
};

const stringToSeed = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// --- 剪贴板兼容处理 ---
const copyToClipboard = (text) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }
  document.body.removeChild(textArea);
};

// --- Tushare API 调用 ---
const fetchTushareData = async (token, ticker, startDate, endDate) => {
  const profile = STOCK_PROFILES[ticker];
  if (!profile) throw new Error("未找到股票代码配置");

  const start = startDate.replace(/-/g, '');
  const end = endDate.replace(/-/g, '');

  try {
    const response = await fetch('https://api.tushare.pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_name: 'daily',
        token: token,
        params: { ts_code: profile.ts_code, start_date: start, end_date: end },
        fields: 'trade_date,open,close,high,low,vol'
      })
    });

    if (!response.ok) throw new Error(`网络请求失败: ${response.status}`);
    const result = await response.json();
    if (result.code !== 0) throw new Error(result.msg || "Tushare API 返回错误");
    if (!result.data || !result.data.items || result.data.items.length === 0) throw new Error("该时间段无数据");

    const rawItems = result.data.items.reverse();
    return rawItems.map(item => ({
      date: item[0].replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
      open: item[1],
      close: item[2],
      high: item[3],
      low: item[4],
      volume: item[5]
    }));
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('CORS_BLOCK'); 
    }
    throw error;
  }
};

// --- 确定性模拟数据生成器 ---
const generateMockData = (ticker, startDateStr, endDateStr) => {
  const profile = STOCK_PROFILES[ticker] || STOCK_PROFILES['600519'];
  const seed = stringToSeed(ticker + "2024"); 
  const random = seededRandom(seed);
  let price = profile.startPrice;
  const data = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.abs(end - start);
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const preRollDays = 50; 
  let currentDate = new Date(start);
  currentDate.setDate(currentDate.getDate() - preRollDays);
  const totalDays = days + preRollDays;

  for (let i = 0; i <= totalDays; i++) {
    const r1 = random();
    const r2 = random();
    const r3 = random();
    const change = (r1 - 0.48) * profile.volatility + profile.trend; 
    price = price * (1 + change);
    if (price < 0.01) price = 0.01;
    const dateStr = currentDate.toISOString().split('T')[0];
    const high = price * (1 + r2 * 0.015);
    const low = price * (1 - r3 * 0.015);
    data.push({
      date: dateStr,
      open: parseFloat(price.toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      volume: Math.floor(random() * 1000000)
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return data;
};

// --- 指标计算与回测 ---
const calculateBollingerBands = (data, window = 20, multiplier = 2) => {
  return data.map((item, index) => {
    if (index < window - 1) return { ...item, mb: null, ub: null, lb: null };
    const slice = data.slice(index - window + 1, index + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    const mean = sum / window;
    const squaredDiffs = slice.map(curr => Math.pow(curr.close - mean, 2));
    const variance = squaredDiffs.reduce((acc, curr) => acc + curr, 0) / window;
    const stdDev = Math.sqrt(variance);
    return { ...item, mb: mean, ub: mean + (stdDev * multiplier), lb: mean - (stdDev * multiplier) };
  });
};

const runBacktest = (data, initialCapital, period, multiplier, startDateStr) => {
  const fullData = calculateBollingerBands(data, period, multiplier);
  const validData = fullData.filter(d => d.date >= startDateStr);
  let cash = initialCapital;
  let shares = 0;
  const trades = [];
  const equityCurve = [];
  let winCount = 0;
  let totalTrades = 0;

  for (let i = 0; i < validData.length; i++) {
    const today = validData[i];
    if (!today.lb || !today.ub) {
      equityCurve.push({ ...today, equity: cash + (shares * today.close), action: null, buySignal: null, sellSignal: null });
      continue;
    }
    let action = null;
    const price = today.close;
    let buySignalVal = null;
    let sellSignalVal = null;
    const isBuySignal = price <= today.lb;
    const isSellSignal = price >= today.ub;

    if (isBuySignal && cash > price * 100) {
      const buyAmount = Math.floor(cash / (price * 100)) * 100;
      if (buyAmount > 0) {
        shares += buyAmount;
        cash -= buyAmount * price;
        action = 'buy';
        buySignalVal = price;
        trades.push({ date: today.date, type: '买入', price: price, shares: buyAmount, reason: `股价(${price}) 触及下轨` });
      }
    } else if (isSellSignal && shares > 0) {
      const sellAmount = shares;
      const lastBuy = trades.slice().reverse().find(t => t.type === '买入');
      if (lastBuy && price > lastBuy.price) winCount++;
      totalTrades++;
      cash += sellAmount * price;
      shares = 0;
      action = 'sell';
      sellSignalVal = price;
      trades.push({ date: today.date, type: '卖出', price: price, shares: sellAmount, reason: `股价(${price}) 触及上轨` });
    }
    const totalEquity = cash + (shares * price);
    equityCurve.push({ ...today, equity: totalEquity, action: action, buySignal: buySignalVal, sellSignal: sellSignalVal });
  }

  const finalEquity = equityCurve[equityCurve.length - 1]?.equity || initialCapital;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  const maxEquity = Math.max(...equityCurve.map(e => e.equity));
  const minEquityAfterMax = Math.min(...equityCurve.map(e => e.equity));
  const maxDrawdown = maxEquity > 0 ? ((maxEquity - minEquityAfterMax) / maxEquity) * 100 : 0;

  return {
    equityCurve, trades,
    metrics: { totalReturn: totalReturn.toFixed(2), finalEquity: finalEquity.toFixed(2), maxDrawdown: Math.abs(maxDrawdown).toFixed(2), winRate: totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(2) : 0, totalTrades }
  };
};

// --- 组件 ---
const BuyMarker = ({ cx, cy }) => Number.isFinite(cx) && Number.isFinite(cy) ? <g transform={`translate(${cx},${cy})`}><polygon points="0,-8 -6,4 6,4" fill="#ef4444" /><text x="0" y="14" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold">买</text></g> : null;
const SellMarker = ({ cx, cy }) => Number.isFinite(cx) && Number.isFinite(cy) ? <g transform={`translate(${cx},${cy})`}><polygon points="0,8 -6,-4 6,-4" fill="#22c55e" /><text x="0" y="-10" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="bold">卖</text></g> : null;

export default function QuantBacktestPlatform() {
  const [selectedStock, setSelectedStock] = useState('600519');
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2023-12-31');
  const [initialCapital, setInitialCapital] = useState(500000);
  const [bollingerPeriod, setBollingerPeriod] = useState(20);
  const [bollingerMultiplier, setBollingerMultiplier] = useState(2);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('chart');
  const [showStrategyInfo, setShowStrategyInfo] = useState(false);
  
  // 数据与状态
  const [apiToken, setApiToken] = useState('ed0e097e6172225f33825bd6a6545589ec836bab5c1be33b6674576d');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dataMode, setDataMode] = useState('tushare'); 
  const [showDataHelper, setShowDataHelper] = useState(false); 
  const [manualJson, setManualJson] = useState(''); 
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => { runSimulation(); }, []);

  // 动态生成脚本
  const tushareScript = `import tushare as ts\nimport json\n\ntoken = '${apiToken}'\npro = ts.pro_api(token)\ndf = pro.daily(ts_code='${STOCK_PROFILES[selectedStock].ts_code}', start_date='${startDate.replace(/-/g,'')}', end_date='${endDate.replace(/-/g,'')}')\ndata = []\nfor index, row in df.iterrows():\n    data.append({\n        "date": row['trade_date'][:4] + '-' + row['trade_date'][4:6] + '-' + row['trade_date'][6:],\n        "open": row['open'], "close": row['close'],\n        "high": row['high'], "low": row['low'], "volume": row['vol']\n    })\ndata.reverse()\nprint(json.dumps(data))`;

  const bsCode = STOCK_PROFILES[selectedStock].ts_code.split('.').reverse().join('.').toLowerCase(); 
  const baostockScript = `import baostock as bs\nimport pandas as pd\nimport json\nlg = bs.login()\nrs = bs.query_history_k_data_plus("${bsCode}", "date,open,high,low,close,volume", start_date='${startDate}', end_date='${endDate}', frequency="d", adjustflag="3")\ndata_list = []\nwhile (rs.error_code == '0') & rs.next():\n    row = rs.get_row_data()\n    data_list.append({ "date": row[0], "open": float(row[1]), "high": float(row[2]), "low": float(row[3]), "close": float(row[4]), "volume": float(row[5]) })\nbs.logout()\nprint(json.dumps(data_list))`;

  const handleCopy = () => {
      const text = dataMode === 'baostock' ? baostockScript : tushareScript;
      copyToClipboard(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const runSimulation = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setResults(null);
    let marketData = [];

    try {
      if (dataMode === 'manual') {
        if (!manualJson) throw new Error("请先粘贴数据");
        try {
          marketData = JSON.parse(manualJson);
        } catch (e) { throw new Error("JSON格式错误，请检查粘贴内容"); }
      } 
      else if (dataMode === 'tushare') {
        try {
          marketData = await fetchTushareData(apiToken, selectedStock, startDate, endDate);
        } catch (err) {
          if (err.message === 'CORS_BLOCK') {
            setShowDataHelper(true);
            setErrorMsg("浏览器拦截了Tushare请求 (跨域限制)");
          } else {
            setErrorMsg(err.message);
          }
          setIsLoading(false);
          return;
        }
      } 
      else if (dataMode === 'baostock') {
        setShowDataHelper(true);
        setErrorMsg("Baostock 需使用本地 Python 脚本获取数据");
        setIsLoading(false);
        return;
      }
      else {
        marketData = generateMockData(selectedStock, startDate, endDate);
      }

      if (!marketData || marketData.length === 0) throw new Error("数据为空");
      const res = runBacktest(marketData, initialCapital, bollingerPeriod, bollingerMultiplier, startDate);
      setResults(res);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeSwitch = (mode) => {
    setDataMode(mode);
    setErrorMsg('');
    if (mode === 'baostock') {
      setShowDataHelper(true);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8 flex flex-col gap-6 relative">
      
      {/* Modal 代码省略，与之前相同 */}
      {showDataHelper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Database className={dataMode === 'baostock' ? "text-purple-400" : "text-red-400"} />
                {dataMode === 'baostock' ? "从 Baostock 获取数据" : "无法直接连接 Tushare"}
              </h2>
              <button onClick={() => setShowDataHelper(false)}><X className="text-slate-400 hover:text-white"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <p className="text-slate-300 text-sm">
                {dataMode === 'baostock' 
                  ? "Baostock (证券宝) 是纯 Python 库，不支持浏览器直接访问。请运行以下脚本获取数据。"
                  : "这是浏览器的安全机制（CORS）拦截了请求。Tushare服务器不允许网页直接访问。"}
              </p>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-green-400 font-bold mb-2 flex items-center gap-2">第一步：复制 Python 脚本</h3>
                <p className="text-xs text-slate-400 mb-3">{dataMode === 'baostock' ? "需 pip install baostock pandas" : "需 pip install tushare"}</p>
                <div className="bg-black p-3 rounded text-xs font-mono text-slate-300 overflow-x-auto relative group">
                  <pre>{dataMode === 'baostock' ? baostockScript : tushareScript}</pre>
                  <button onClick={handleCopy} className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded flex items-center gap-1">
                    <Clipboard size={12}/> {copySuccess ? "已复制" : "复制代码"}
                  </button>
                </div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">第二步：粘贴运行结果</h3>
                <textarea 
                  value={manualJson}
                  onChange={(e) => { setManualJson(e.target.value); if(e.target.value) setDataMode('manual'); }}
                  placeholder="在此处粘贴 Python 脚本运行输出的 JSON 数据..."
                  className="w-full h-24 bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-green-300 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <button 
                  onClick={() => { if (manualJson) { setDataMode('manual'); setShowDataHelper(false); runSimulation(); } }}
                  disabled={!manualJson}
                  className="mt-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  加载数据并回测
                </button>
              </div>
              {dataMode === 'tushare' && (
               <div className="text-center pt-2">
                  <button onClick={() => { handleModeSwitch('mock'); setShowDataHelper(false); setTimeout(runSimulation, 100); }} className="text-slate-500 text-xs hover:text-slate-300 underline">
                    放弃真实数据，使用高仿真模拟数据 &gt;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-700 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-blue-400">
            <Activity className="h-6 w-6" />
            AlphaQuant Pro
          </h1>
          <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
            <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded text-xs border border-blue-800">布林带策略</span>
            <span className="text-slate-500">|</span>
            {STOCK_PROFILES[selectedStock].name} ({STOCK_PROFILES[selectedStock].ts_code})
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={() => setShowStrategyInfo(true)} className="flex-1 md:flex-none flex justify-center items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition border border-slate-600">
            <BookOpen size={18} /> 策略详解
          </button>
          <button onClick={runSimulation} disabled={isLoading} className="flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 rounded-lg font-bold transition shadow-lg shadow-blue-900/50 active:scale-95">
            {isLoading ? <Loader2 className="animate-spin" size={18}/> : <Play size={18} fill="currentColor" />} 
            {isLoading ? '计算中...' : '开始回测'}
          </button>
        </div>
      </header>

      {errorMsg && !showDataHelper && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-200 px-4 py-3 rounded-lg text-sm flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
          {(errorMsg.includes('CORS') || errorMsg.includes('Baostock')) && (
            <button onClick={() => setShowDataHelper(true)} className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded">
              获取数据脚本
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：设置面板 */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* 1. 数据源模式 */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
             <h2 className="flex items-center gap-2 font-semibold text-base mb-4 text-slate-200 border-b border-slate-700 pb-2">
              <Settings size={16} /> 数据源模式
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleModeSwitch('tushare')}
                    className={`flex-1 py-2 text-xs rounded-lg border transition ${dataMode === 'tushare' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-600 text-slate-400 hover:bg-slate-800'}`}
                  >
                    Tushare (真实)
                  </button>
                  <button 
                    onClick={() => handleModeSwitch('baostock')}
                    className={`flex-1 py-2 text-xs rounded-lg border transition ${dataMode === 'baostock' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-600 text-slate-400 hover:bg-slate-800'}`}
                  >
                    Baostock (真实)
                  </button>
                </div>
                <button 
                  onClick={() => handleModeSwitch('mock')}
                  className={`w-full py-2 text-xs rounded-lg border transition ${dataMode === 'mock' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-900 border-slate-600 text-slate-400 hover:bg-slate-800'}`}
                >
                  模拟数据 (固定随机)
                </button>
              </div>

              {dataMode === 'tushare' && (
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Tushare Token</label>
                  <input type="text" value={apiToken} onChange={(e) => setApiToken(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 px-2 text-xs text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none truncate"/>
                </div>
              )}
              
              <button 
                onClick={() => setShowDataHelper(true)}
                className={`w-full py-2 text-xs rounded-lg border flex items-center justify-center gap-2 ${dataMode === 'manual' ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
              >
                <FileJson size={14} /> 
                {dataMode === 'manual' ? '已导入手动数据' : '手动导入 JSON'}
              </button>
            </div>
          </div>

          {/* 2. 标的与时间 */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
            <h2 className="flex items-center gap-2 font-semibold text-base mb-4 text-slate-200 border-b border-slate-700 pb-2">
              <Search size={16} /> 标的与时间
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5 font-bold">选择股票</label>
                <select value={selectedStock} onChange={(e) => setSelectedStock(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {Object.entries(STOCK_PROFILES).map(([code, info]) => (
                    <option key={code} value={code}>{code} - {info.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">开始日期</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pl-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-slate-200"/>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">结束日期</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pl-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-slate-200"/>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 策略参数 (已恢复) */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
             <h2 className="flex items-center gap-2 font-semibold text-base mb-4 text-slate-200 border-b border-slate-700 pb-2">
              <Settings size={16} /> 策略参数
            </h2>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-slate-400 text-xs">周期 (Window)</label>
                  <span className="text-blue-400 text-xs font-mono">{bollingerPeriod}日</span>
                </div>
                <input type="range" min="5" max="60" step="1" value={bollingerPeriod} onChange={(e) => setBollingerPeriod(Number(e.target.value))} className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-slate-400 text-xs">标准差倍数 (StdDev)</label>
                  <span className="text-orange-400 text-xs font-mono">{bollingerMultiplier}x</span>
                </div>
                <input type="range" min="1" max="4" step="0.1" value={bollingerMultiplier} onChange={(e) => setBollingerMultiplier(Number(e.target.value))} className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-orange-500" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">初始资金</label>
                <div className="relative">
                  <DollarSign size={12} className="absolute left-3 top-3 text-slate-500" />
                  <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pl-8 pr-3 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* 4. 回测绩效面板 (已恢复并美化) */}
          {results && (
             <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h2 className="flex items-center gap-2 font-semibold text-base mb-4 text-slate-200 border-b border-slate-700 pb-2">
                 <BarChart2 size={16} /> 核心绩效
               </h2>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition"><TrendingUp size={40}/></div>
                    <div className="text-slate-500 text-[10px] mb-1">总收益率</div>
                    <div className={`text-xl font-bold ${Number(results.metrics.totalReturn) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {Number(results.metrics.totalReturn) > 0 ? '+' : ''}{results.metrics.totalReturn}%
                    </div>
                  </div>
                  
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition"><TrendingDown size={40}/></div>
                    <div className="text-slate-500 text-[10px] mb-1">最大回撤</div>
                    <div className="text-lg font-bold text-slate-200">{results.metrics.maxDrawdown}%</div>
                  </div>

                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30 flex flex-col justify-between">
                    <div className="text-slate-500 text-[10px] mb-1">胜率</div>
                    <div className="text-lg font-bold text-slate-200">{results.metrics.winRate}%</div>
                  </div>

                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30 flex flex-col justify-between">
                    <div className="text-slate-500 text-[10px] mb-1">最终资产</div>
                    <div className="text-lg font-bold text-blue-400">¥{(results.metrics.finalEquity / 10000).toFixed(1)}w</div>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* 右侧：图表 */}
        <div className="lg:col-span-9 flex flex-col gap-6">
          <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-xl min-h-[500px] flex flex-col">
             <div className="flex gap-2 p-3 border-b border-slate-700/50 justify-between items-center">
              <div className="flex gap-2">
                <button onClick={() => setActiveTab('chart')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'chart' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50'}`}>K线</button>
                <button onClick={() => setActiveTab('equity')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'equity' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50'}`}>收益曲线</button>
                <button onClick={() => setActiveTab('trades')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'trades' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50'}`}>交易明细</button>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 px-2">
                {dataMode === 'mock' && <><WifiOff size={14} className="text-orange-500"/><span className="text-orange-400">模拟模式</span></>}
                {dataMode === 'tushare' && <><Wifi size={14} className="text-blue-500"/><span>Tushare API</span></>}
                {dataMode === 'baostock' && <><Wifi size={14} className="text-purple-500"/><span>Baostock</span></>}
                {dataMode === 'manual' && <><FileJson size={14} className="text-green-500"/><span className="text-green-400">手动导入模式</span></>}
              </div>
            </div>

            <div className="flex-1 p-4">
            {isLoading ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                 <Loader2 className="animate-spin text-blue-500" size={48} />
                 <p>正在获取数据...</p>
               </div>
            ) : results ? (
              <>
              {activeTab === 'chart' && (
                <div className="h-[450px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={results.equityCurve} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="date" tick={{fill: '#64748b', fontSize: 10}} minTickGap={50} />
                      <YAxis domain={['auto', 'auto']} tick={{fill: '#64748b', fontSize: 11}} width={50} />
                      <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px'}} />
                      <Legend iconType="plainline" />
                      <Line type="monotone" dataKey="ub" stroke="#ef4444" strokeDasharray="3 3" dot={false} strokeWidth={1} name="上轨" />
                      <Line type="monotone" dataKey="lb" stroke="#22c55e" strokeDasharray="3 3" dot={false} strokeWidth={1} name="下轨" />
                      <Line type="monotone" dataKey="mb" stroke="#fbbf24" dot={false} strokeWidth={1} name="中轨" />
                      <Line type="monotone" dataKey="close" stroke="#f8fafc" dot={false} strokeWidth={1.5} name="股价" />
                      <Scatter name="买入点" dataKey="buySignal" shape={<BuyMarker />} legendType="triangle" fill="#ef4444" />
                      <Scatter name="卖出点" dataKey="sellSignal" shape={<SellMarker />} legendType="triangle" fill="#22c55e" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {activeTab === 'equity' && (
                 <div className="h-[450px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={results.equityCurve}>
                     <defs><linearGradient id="colorEq" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                     <XAxis dataKey="date" tick={{fill: '#64748b', fontSize: 10}} minTickGap={50} />
                     <YAxis domain={['auto', 'auto']} tick={{fill: '#64748b', fontSize: 11}} width={60} tickFormatter={(val) => `¥${(val/10000).toFixed(1)}w`} />
                     <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc'}} />
                     <Area type="monotone" dataKey="equity" stroke="#3b82f6" fill="url(#colorEq)" strokeWidth={2} name="总资产" />
                   </ComposedChart>
                 </ResponsiveContainer>
               </div>
              )}
              {activeTab === 'trades' && (
                <div className="h-[450px] overflow-y-auto custom-scrollbar">
                   <table className="w-full text-sm text-left">
                    <thead className="bg-slate-700/50 text-slate-300 sticky top-0 backdrop-blur-md">
                      <tr><th className="p-3">日期</th><th className="p-3">方向</th><th className="p-3 text-right">价格</th><th className="p-3 text-right">股数</th><th className="p-3">原因</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {results.trades.map((trade, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/20">
                          <td className="p-3 text-slate-400 font-mono text-xs">{trade.date}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs border ${trade.type === '买入' ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-green-500/30 text-green-400 bg-green-500/10'}`}>{trade.type}</span></td>
                          <td className="p-3 text-right text-slate-200">¥{trade.price.toFixed(2)}</td>
                          <td className="p-3 text-right text-slate-200">{trade.shares}</td>
                          <td className="p-3 text-slate-500 text-xs">{trade.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                   </table>
                   {results.trades.length === 0 && <div className="h-40 flex items-center justify-center text-slate-500">无交易信号</div>}
                </div>
              )}
              </>
            ) : <div className="h-full flex items-center justify-center text-slate-500">点击“开始回测”</div>}
            </div>
          </div>
        </div>
      </div>
      
      {/* 策略说明 Modal */}
      {showStrategyInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-white">策略说明</h2><button onClick={() => setShowStrategyInfo(false)}><X className="text-slate-400 hover:text-white"/></button></div>
            <p className="text-slate-300 text-sm">股价触及布林带下轨买入，触及上轨卖出。</p>
          </div>
        </div>
      )}
    </div>
  );
}