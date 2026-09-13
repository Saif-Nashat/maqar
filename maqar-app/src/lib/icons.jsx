import { Presentation, Projector, Coffee, Car, Wifi, Wind } from "lucide-react";

const MAP = {
  Whiteboard: Presentation,
  Projector: Projector,
  Coffee: Coffee,
  Parking: Car,
  Wifi: Wifi,
  "Air conditioning": Wind,
};

export function FeatIcon({ name, className = "w-3.5 h-3.5" }) {
  const Ico = MAP[name] || Coffee;
  return <Ico className={className} />;
}
