/**
 * 天气查询工具
 * 使用 Open-Meteo API（免费、无需 API Key）
 */

interface GeocodingResult {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}

interface WeatherResult {
  temperature: number;
  windspeed: number;
  weathercode: number;
  isDay: number;
}

interface ForecastData {
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weathercode: number[];
    precipitation_probability_max?: number[];
  };
  current_weather?: WeatherResult;
  hourly?: {
    relativehumidity_2m: number[];
  };
}

const WEATHER_CODE_MAP: Record<number, string> = {
  0: '晴',
  1: '晴间多云',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '雾凇',
  51: '小毛毛雨',
  53: '中毛毛雨',
  55: '大毛毛雨',
  56: '冻毛毛雨',
  57: '强冻毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '强冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪粒',
  80: '小阵雨',
  81: '中阵雨',
  82: '大阵雨',
  85: '小阵雪',
  86: '大阵雪',
  95: '雷暴',
  96: '雷暴伴小冰雹',
  99: '雷暴伴大冰雹',
};

function getDateParam(date?: string): { startDate: string; endDate: string; timezone: string } {
  if (!date || date === '今天' || date === '当前') {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return {
      startDate: `${yyyy}-${mm}-${dd}`,
      endDate: `${yyyy}-${mm}-${dd}`,
      timezone: 'Asia/Shanghai',
    };
  }

  if (date === '明天') {
    const tomorrow = new Date(Date.now() + 86400000);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    return {
      startDate: `${yyyy}-${mm}-${dd}`,
      endDate: `${yyyy}-${mm}-${dd}`,
      timezone: 'Asia/Shanghai',
    };
  }

  if (date === '后天') {
    const dayAfter = new Date(Date.now() + 86400000 * 2);
    const yyyy = dayAfter.getFullYear();
    const mm = String(dayAfter.getMonth() + 1).padStart(2, '0');
    const dd = String(dayAfter.getDate()).padStart(2, '0');
    return {
      startDate: `${yyyy}-${mm}-${dd}`,
      endDate: `${yyyy}-${mm}-${dd}`,
      timezone: 'Asia/Shanghai',
    };
  }

  // 尝试解析日期字符串
  const parsed = new Date(date);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return {
      startDate: `${yyyy}-${mm}-${dd}`,
      endDate: `${yyyy}-${mm}-${dd}`,
      timezone: 'Asia/Shanghai',
    };
  }

  // 默认今天
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return {
    startDate: `${yyyy}-${mm}-${dd}`,
    endDate: `${yyyy}-${mm}-${dd}`,
    timezone: 'Asia/Shanghai',
  };
}

export async function getWeather(city: string, date?: string): Promise<string> {
  // 第一步：城市名转经纬度
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=zh`;
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) {
    throw new Error(`地理编码请求失败: ${geoRes.status}`);
  }

  const geoData = await geoRes.json() as { results?: GeocodingResult[] };

  if (!geoData.results || geoData.results.length === 0) {
    throw new Error(`未找到城市 "${city}"，请尝试使用中文全拼或英文名`);
  }

  const location = geoData.results[0];
  const { latitude, longitude, name, country } = location;

  // 第二步：查询天气
  const { startDate, endDate, timezone } = getDateParam(date);
  const isForecast = date && date !== '今天' && date !== '当前';

  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.searchParams.set('latitude', String(latitude));
  weatherUrl.searchParams.set('longitude', String(longitude));
  weatherUrl.searchParams.set('timezone', timezone);

  if (isForecast) {
    weatherUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max');
    weatherUrl.searchParams.set('forecast_days', '7');
  } else {
    weatherUrl.searchParams.set('current_weather', 'true');
    weatherUrl.searchParams.set('hourly', 'relativehumidity_2m');
  }

  const weatherRes = await fetch(weatherUrl.toString());
  if (!weatherRes.ok) {
    throw new Error(`天气查询请求失败: ${weatherRes.status}`);
  }

  const weatherData = await weatherRes.json() as ForecastData;

  // 第三步：格式化返回
  if (isForecast) {
    const daily = weatherData.daily!;

    // 在 7 天预报中找到对应日期
    const targetDate = startDate;
    const dayIndex = daily.time.indexOf(targetDate);
    const idx = dayIndex >= 0 ? dayIndex : 0;

    const weatherDesc = WEATHER_CODE_MAP[daily.weathercode[idx]] || '未知';
    const maxTemp = daily.temperature_2m_max[idx];
    const minTemp = daily.temperature_2m_min[idx];
    const rainProb = daily.precipitation_probability_max?.[idx] ?? 0;

    return `${name}(${country}) ${date} 天气预报：${weatherDesc}，气温 ${minTemp}°C ~ ${maxTemp}°C，降雨概率 ${rainProb}%`;
  } else {
    const cw = weatherData.current_weather!;
    const weatherDesc = WEATHER_CODE_MAP[cw.weathercode] || '未知';
    const dayNight = cw.isDay === 1 ? '白天' : '夜间';
    const windSpeed = cw.windspeed.toFixed(1);

    // 尝试获取湿度
    let humidity = '';
    if (weatherData.hourly) {
      const currentHour = new Date().getHours();
      const hum = weatherData.hourly.relativehumidity_2m[currentHour];
      if (hum !== undefined) {
        humidity = `，湿度 ${hum}%`;
      }
    }

    return `${name}(${country}) ${dayNight}天气：${weatherDesc}，气温 ${cw.temperature}°C，风速 ${windSpeed} km/h${humidity}`;
  }
}

// 工具描述（供 AI 理解）
export const weatherToolDefinition = {
  type: "function" as const,
  function: {
    name: "get_weather",
    description: "查询指定城市的天气信息，包括温度、天气状况、湿度、风速等。支持查询今天、明天、后天或具体日期的天气。",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "城市名称，支持中文（如上海、北京）、拼音（如Shanghai）或英文（如Tokyo）"
        },
        date: {
          type: "string",
          description: "查询日期，可选值：今天、明天、后天，或具体日期如 2024-03-15。默认为今天"
        }
      },
      required: ["city"]
    }
  }
};
