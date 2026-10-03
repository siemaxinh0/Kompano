import L from "leaflet";

export const servicePinIcon = L.divIcon({
  className: "",
  html: `<span style="display:flex;width:40px;height:40px;border-radius:9999px;background:#059669;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.3);align-items:center;justify-content:center;">
    <span style="width:12px;height:12px;border-radius:9999px;background:white;"></span>
  </span>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

export const helperPinIcon = L.divIcon({
  className: "",
  html: `<span style="display:flex;width:40px;height:40px;border-radius:9999px;background:#0ea5e9;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);align-items:center;justify-content:center;font:bold 14px/1 system-ui,sans-serif;color:white;">M</span>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

export function createDestinationPinIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="position:relative;display:flex;width:28px;height:28px;align-items:center;justify-content:center;">
      <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(5,150,105,.25);animation:helpovski-pulse 1.8s ease-out infinite;"></span>
      <span style="position:relative;display:flex;width:18px;height:18px;border-radius:9999px;background:#059669;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.28);"></span>
    </span>
    <style>@keyframes helpovski-pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.2);opacity:0}}</style>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function createHelperAvatarIcon(avatarUrl: string): L.DivIcon {
  const safeUrl = avatarUrl.replace(/"/g, "&quot;");
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:52px;height:52px;border-radius:9999px;border:3px solid #fff;box-shadow:0 4px 18px rgba(0,0,0,.28);overflow:hidden;background:#e5e7eb;position:relative;">
      <img src="${safeUrl}" alt="" width="52" height="52" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;" />
      <span style="position:absolute;right:2px;bottom:2px;width:12px;height:12px;border-radius:9999px;background:#0ea5e9;border:2px solid #fff;"></span>
    </span>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
}

