export const A11Y_STORAGE_KEY = "helpovski-a11y";

/** Uruchamiany przed hydratacją, żeby rozmiar tekstu i kontrast nie „mrugały”. */
export const A11Y_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("${A11Y_STORAGE_KEY}")||"{}");var r=document.documentElement;if(p.textSize&&p.textSize!=="normal")r.dataset.textSize=p.textSize;if(p.highContrast)r.classList.add("hc");if(p.reduceMotion)r.classList.add("reduce-motion")}catch(e){}`;
