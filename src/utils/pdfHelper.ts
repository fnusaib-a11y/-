import html2pdf from 'html2pdf.js';

/**
 * Pure math-based OKLCH to RGB conversion string parser.
 * This runs offline, requires zero canvas APIs, prevents recursive calls,
 * and converts OKLCH colors perfectly to sRGB to be parsed by html2canvas securely.
 */
export const oklchToRgbString = (oklchStr: string): string => {
  try {
    const match = oklchStr.match(/oklch\s*\(\s*([\d.-]+%?)\s+([\d.-]+%?)\s+([\d.-]+(?:deg|rad|grad|turn)?)(?:\s*\/\s*([\d.-]+%?))?\s*\)/i);
    if (!match) return oklchStr;
    
    let LStr = match[1];
    let CStr = match[2];
    let HStr = match[3];
    let AStr = match[4];
    
    const L = LStr.endsWith('%') ? parseFloat(LStr) / 100 : parseFloat(LStr);
    const C = CStr.endsWith('%') ? parseFloat(CStr) / 100 : parseFloat(CStr);
    
    let H = parseFloat(HStr);
    if (HStr.endsWith('rad')) {
      H = (parseFloat(HStr) * 180) / Math.PI;
    } else if (HStr.endsWith('grad')) {
      H = parseFloat(HStr) * 0.9;
    } else if (HStr.endsWith('turn')) {
      H = parseFloat(HStr) * 360;
    }
    
    const A = AStr ? (AStr.endsWith('%') ? parseFloat(AStr) / 100 : parseFloat(AStr)) : 1;
    
    // Oklab constant conversion
    const hRad = (H * Math.PI) / 180;
    const aLab = C * Math.cos(hRad);
    const bLab = C * Math.sin(hRad);
    
    // Convert to LMS color space
    const l_lms = L + 0.3963377774 * aLab + 0.2158037573 * bLab;
    const m_lms = L - 0.1055613458 * aLab - 0.0638541728 * bLab;
    const s_lms = L - 0.0894841775 * aLab - 1.2914855414 * bLab;
    
    const l_ = l_lms * l_lms * l_lms;
    const m_ = m_lms * m_lms * m_lms;
    const s_ = s_lms * s_lms * s_lms;
    
    // Convert LMS to Linear RGB
    const r_lin = +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
    const g_lin = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
    const b_lin = -0.0041960863 * l_ - 0.703418614 * m_ + 1.707614701 * s_;
    
    // Standard gamma compression to sRGB
    const compress = (x: number) => {
      const clamped = Math.max(0, Math.min(1, x));
      return clamped <= 0.0031308
        ? clamped * 12.92
        : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    };
    
    const r = Math.round(compress(r_lin) * 255);
    const g = Math.round(compress(g_lin) * 255);
    const b = Math.round(compress(b_lin) * 255);
    
    if (A < 1) {
      return `rgba(${r}, ${g}, ${b}, ${A})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  } catch (err) {
    return 'rgb(71, 85, 105)'; // Safe, neutral slate grey fallback
  }
};

export const oklabToRgbString = (oklabStr: string): string => {
  try {
    const match = oklabStr.match(/oklab\s*\(\s*([\d.-]+%?)\s+([\d.-]+%?)\s+([\d.-]+%?)(?:\s*\/\s*([\d.-]+%?))?\s*\)/i);
    if (!match) return oklabStr;
    
    let LStr = match[1];
    let aStr = match[2];
    let bStr = match[3];
    let AStr = match[4];
    
    const L_val = LStr.endsWith('%') ? parseFloat(LStr) / 100 : parseFloat(LStr);
    const a_val = aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);
    const b_val = bStr.endsWith('%') ? parseFloat(bStr) / 100 : parseFloat(bStr);
    
    const A = AStr ? (AStr.endsWith('%') ? parseFloat(AStr) / 100 : parseFloat(AStr)) : 1;
    
    // Convert to LMS color space using okLAB constants
    const l_lms = L_val + 0.3963377774 * a_val + 0.2158037573 * b_val;
    const m_lms = L_val - 0.1055613458 * a_val - 0.0638541728 * b_val;
    const s_lms = L_val - 0.0894841775 * a_val - 1.2914855414 * b_val;
    
    const l_ = l_lms * l_lms * l_lms;
    const m_ = m_lms * m_lms * m_lms;
    const s_ = s_lms * s_lms * s_lms;
    
    // Convert LMS to Linear RGB
    const r_lin = +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
    const g_lin = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
    const b_lin = -0.0041960863 * l_ - 0.703418614 * m_ + 1.707614701 * s_;
    
    // Standard gamma compression to sRGB
    const compress = (x: number) => {
      const clamped = Math.max(0, Math.min(1, x));
      return clamped <= 0.0031308
        ? clamped * 12.92
        : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    };
    
    const r = Math.round(compress(r_lin) * 255);
    const g = Math.round(compress(g_lin) * 255);
    const b = Math.round(compress(b_lin) * 255);
    
    if (A < 1) {
      return `rgba(${r}, ${g}, ${b}, ${A})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  } catch (err) {
    return 'rgb(71, 85, 105)'; // Safe, neutral slate grey fallback
  }
};

/**
 * Replaces all occurrences of oklch(...) or oklab(...) inside a css text / styles attribute block.
 */
export const sanitizeColors = (cssText: string): string => {
  if (!cssText || typeof cssText !== 'string') return cssText;
  
  // 1. Sanitize oklch
  const oklchRegex = /oklch\s*\(\s*[\d.-]+%?\s+[\d.-]+%?\s+[\d.-]+(?:deg|rad|grad|turn)?(?:\s*\/\s*[\d.-]+%?)?\s*\)/gi;
  let running = cssText.replace(oklchRegex, (match) => oklchToRgbString(match));
  
  // 2. Sanitize oklab
  const oklabRegex = /oklab\s*\(\s*[\d.-]+%?\s+[\d.-]+%?\s+[\d.-]+%?(?:\s*\/\s*[\d.-]+%?)?\s*\)/gi;
  running = running.replace(oklabRegex, (match) => oklabToRgbString(match));
  
  return running;
};

/**
 * Dynamic PDF generation utility.
 */
export const downloadPdf = async (elementId: string, filename: string, title?: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('ডাউনলোডযোগ্য উপাদানটি খুঁজে পাওয়া যায়নি!');
    return;
  }

  // Preserve original getComputedStyle and styleSheets descriptor
  const originalGetComputedStyle = window.getComputedStyle;
  
  let tempStyle: HTMLStyleElement | null = null;
  let hasOverriddenStyleSheets = false;
  let originalStyleSheetsDescriptor = Object.getOwnPropertyDescriptor(document, 'styleSheets');
  if (!originalStyleSheetsDescriptor) {
    originalStyleSheetsDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'styleSheets');
  }

  // 1. Recursive helper to clean nested inline styling of clones
  const sanitizeElementStyles = (el: HTMLElement) => {
    // Sanitize standard style attributes
    const styleAttr = el.getAttribute('style');
    if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab') || styleAttr.includes('color('))) {
      el.setAttribute('style', sanitizeColors(styleAttr));
    }
    
    // Sanitize specific attributes like fill, stroke, which might contain colors in svg
    const fillAttr = el.getAttribute('fill');
    if (fillAttr && (fillAttr.includes('oklch') || fillAttr.includes('oklab'))) {
      el.setAttribute('fill', sanitizeColors(fillAttr));
    }
    
    const strokeAttr = el.getAttribute('stroke');
    if (strokeAttr && (strokeAttr.includes('oklch') || strokeAttr.includes('oklab'))) {
      el.setAttribute('stroke', sanitizeColors(strokeAttr));
    }

    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      if (child instanceof HTMLElement) {
        sanitizeElementStyles(child);
      }
    }
  };

  try {
    // 2. Safe, non-destructive proxying of window.getComputedStyle to translate all oklch and oklab values to sRGB
    window.getComputedStyle = function(elt, pseudoElt) {
      const style = originalGetComputedStyle.call(window, elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop) {
          const val = target[prop as any];
          if (typeof val === 'function') {
            return function(...args: any[]) {
              const result = val.apply(target, args);
              if (typeof result === 'string' && (result.includes('oklch') || result.includes('oklab'))) {
                return sanitizeColors(result);
              }
              return result;
            };
          }
          if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
            return sanitizeColors(val);
          }
          return val;
        }
      });
    };

    // 3. Compile and sanitize existing stylesheets
    let combinedCssText = '';
    const originalSheets = Array.from(document.styleSheets);
    for (const sheet of originalSheets) {
      try {
        if (sheet.disabled) continue;
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (let i = 0; i < rules.length; i++) {
          combinedCssText += rules[i].cssText + '\n';
        }
      } catch (e) {
        // Cross-origin styles reading fallback (safe to ignore)
      }
    }

    // Convert oklch to rgb in stylesheet text
    const safeCssText = sanitizeColors(combinedCssText);

    // Create the temporary safe style block
    tempStyle = document.createElement('style');
    tempStyle.id = 'html2pdf-safe-style';
    tempStyle.textContent = safeCssText;
    document.head.appendChild(tempStyle);

    // 4. Override document.styleSheets dynamically so html2canvas only reads our safe style rule lists
    try {
      Object.defineProperty(document, 'styleSheets', {
        get() {
          return tempStyle && tempStyle.sheet ? [tempStyle.sheet] : [];
        },
        configurable: true
      });
      hasOverriddenStyleSheets = true;
    } catch (err) {
      console.warn('Unable to override document.styleSheets:', err);
    }

    // 5. Build the offscreen printable container
    const container = document.createElement('div');
    container.className = "p-8 bg-white text-slate-800 font-sans";
    container.style.width = '790px'; // optimal A4 print viewport

    const isIdCard = elementId === 'printable-id-card';
    const isReceipt = elementId === 'printable-savings-receipt' || elementId.includes('receipt') || filename.includes('receipt') || filename.includes('slip');

    // Add professional layout headers for documents (except receipts and badges)
    if (title && !isIdCard && !isReceipt) {
      const header = document.createElement('div');
      header.className = "text-center mb-8 pb-5 border-b-2 border-slate-100";
      header.innerHTML = `
        <h1 class="text-2xl font-black text-slate-900" style="font-family: system-ui, sans-serif;">ক্ষুদ্র সঞ্চয় সমিতি</h1>
        <p class="text-xs text-slate-500 mt-1.5 font-bold font-sans">রিপোর্ট: ${title}</p>
        <p class="text-[10px] text-slate-400 mt-1">ডাউনলোডের সময়: ${new Date().toLocaleString('bn-BD')} (UTC)</p>
      `;
      container.appendChild(header);
    }

    // Clone target node and inject to container
    const clone = element.cloneNode(true) as HTMLElement;
    
    if (!isIdCard) {
      clone.style.backgroundColor = '#ffffff';
      clone.style.color = '#000000';
    } else {
      clone.style.backgroundColor = 'transparent';
    }

    // Strip control buttons from being printed/rendered
    const ctrlButtons = clone.querySelectorAll('button, a, .no-print');
    ctrlButtons.forEach(btn => ((btn as HTMLElement).style.display = 'none'));

    // Helper to recursively make clone high-contrast monochrome & black-and-white print safe
    const convertToMonochrome = (el: HTMLElement) => {
      // 1. Remove background gradients
      if (el.style.backgroundImage || el.style.background) {
        el.style.backgroundImage = 'none';
        el.style.background = 'none';
      }
      
      // 2. Map Tailwind colorful bg classes to black, white or clean grey values
      const classesToRemove = [
        'bg-emerald-500', 'bg-emerald-600', 'bg-emerald-700', 'bg-emerald-50', 'bg-emerald-100',
        'bg-teal-500', 'bg-teal-600', 'bg-teal-700', 'bg-teal-50', 'bg-teal-100',
        'bg-amber-500', 'bg-amber-600', 'bg-amber-150', 'bg-amber-100', 'bg-amber-50',
        'bg-blue-500', 'bg-blue-600', 'bg-blue-50', 'bg-blue-100',
        'bg-purple-100', 'bg-purple-600', 'bg-purple-50', 'bg-purple-700',
        'bg-indigo-500', 'bg-indigo-600', 'bg-slate-900', 'bg-slate-800'
      ];
      classesToRemove.forEach(cls => {
        if (el.classList.contains(cls)) {
          el.classList.remove(cls);
          if (cls.includes('500') || cls.includes('600') || cls.includes('700') || cls.includes('900') || cls.includes('800')) {
            el.classList.add('bg-neutral-800');
            el.classList.add('text-white');
          } else {
            el.classList.add('bg-neutral-100');
            el.classList.add('text-black');
            el.style.borderColor = '#94a3b8';
          }
        }
      });

      // 3. Remove text classes
      const textColorsToRemove = [
        'text-emerald-500', 'text-emerald-600', 'text-emerald-700', 'text-emerald-800', 'text-emerald-900',
        'text-teal-500', 'text-teal-600', 'text-teal-700', 'text-teal-800', 'text-teal-900',
        'text-blue-500', 'text-blue-600', 'text-blue-700', 'text-blue-800',
        'text-amber-500', 'text-amber-600', 'text-amber-700', 'text-amber-800',
        'text-purple-500', 'text-purple-600', 'text-purple-700',
        'text-slate-500', 'text-slate-600', 'text-slate-700'
      ];
      textColorsToRemove.forEach(cls => {
        if (el.classList.contains(cls)) {
          el.classList.remove(cls);
          el.classList.add('text-black');
        }
      });

      // 4. Force monochrome filters and custom colors
      el.style.filter = 'grayscale(100%) contrast(1.15)';
      
      if (el.tagName.toLowerCase() === 'img') {
        el.style.filter = 'grayscale(100%)';
      }

      // If it is SVG, force black fill and stroke if they are not none
      if (el.tagName.toLowerCase() === 'svg' || el.tagName.toLowerCase() === 'path') {
        const fillVal = el.getAttribute('fill');
        if (fillVal && fillVal !== 'none' && fillVal !== 'transparent') {
          el.setAttribute('fill', '#000000');
        }
        const strokeVal = el.getAttribute('stroke');
        if (strokeVal && strokeVal !== 'none' && strokeVal !== 'transparent') {
          el.setAttribute('stroke', '#000000');
        }
        el.style.color = '#000000';
      }

      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i];
        if (child instanceof HTMLElement) {
          convertToMonochrome(child);
        }
      }
    };

    // Run convertToMonochrome on the clone recursively
    convertToMonochrome(clone);

    // Strip inline styles which might have color formatting as additional fallback
    sanitizeElementStyles(clone);

    container.appendChild(clone);

    // Insert structured reporting footnotes (if non-badge)
    if (!isIdCard) {
      const footer = document.createElement('div');
      footer.className = "mt-12 pt-4 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 font-sans";
      footer.innerHTML = `
        <span>রিপোর্ট আইডি: REF-${Math.floor(100000 + Math.random() * 900000)}</span>
        <span>স্বয়ংক্রিয় জেনারেটেড ক্লাউড পিডিএফ সিস্টেম</span>
      `;
      container.appendChild(footer);
    }

    // Place container offscreen securely
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    const opt = {
      margin:       isIdCard ? 20 : isReceipt ? 10 : 15,
      filename:     filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2.2, useCORS: true, logging: false },
      jsPDF:        { 
        unit: 'mm' as const, 
        format: isReceipt ? ('a5' as const) : ('a4' as const), 
        orientation: 'portrait' as const
      }
    };

    // Execute generation pipeline
    await html2pdf().from(container).set(opt).save();

    // Remove offscreen layout container
    document.body.removeChild(container);

  } catch (error: any) {
    console.error('PDF Generation Failed:', error);
    alert('পিডিএফ ডাউনলোড করা সম্ভব হচ্ছে না, অনুগ্রহ করে আবার চেষ্টা করুন বা ব্রাউজারের প্রিন্ট ফিচার ব্যবহার করুন।');
  } finally {
    // 1. Restore getComputedStyle securely
    if (originalGetComputedStyle) {
      window.getComputedStyle = originalGetComputedStyle;
    }

    // 2. Restore document.styleSheets securely
    if (hasOverriddenStyleSheets) {
      try {
        if (originalStyleSheetsDescriptor) {
          Object.defineProperty(document, 'styleSheets', originalStyleSheetsDescriptor);
        } else {
          delete (document as any).styleSheets;
        }
      } catch (e) {
        try {
          delete (document as any).styleSheets;
        } catch (err) {
          // Ignore
        }
      }
    }

    // 3. Clean up temporary style block
    if (tempStyle && tempStyle.parentNode) {
      tempStyle.parentNode.removeChild(tempStyle);
    }
  }
};
