// ===== WMO weather code → label + icon (Open-Meteo uses WMO codes). =====
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from "lucide-react";

export interface WeatherDescriptor {
  label: string;
  icon: LucideIcon;
}

export function describeWeather(code: number | null | undefined): WeatherDescriptor {
  switch (code) {
    case 0:
      return { label: "Clear sky", icon: Sun };
    case 1:
      return { label: "Mainly clear", icon: CloudSun };
    case 2:
      return { label: "Partly cloudy", icon: CloudSun };
    case 3:
      return { label: "Overcast", icon: Cloud };
    case 45:
    case 48:
      return { label: "Fog", icon: CloudFog };
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return { label: "Drizzle", icon: CloudDrizzle };
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
      return { label: "Rain", icon: CloudRain };
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return { label: "Snow", icon: CloudSnow };
    case 95:
    case 96:
    case 99:
      return { label: "Thunderstorm", icon: CloudLightning };
    default:
      return { label: "—", icon: Cloud };
  }
}
