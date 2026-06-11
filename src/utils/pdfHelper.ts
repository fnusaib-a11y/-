import html2pdf from 'html2pdf.js';

/**
 * Dynamic PDF generation utility using bundled offline-safe html2pdf.js.
 */
export const downloadPdf = async (elementId: string, filename: string, title?: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('ডাউনলোডযোগ্য উপাদানটি খুঁজে পাওয়া যায়নি!');
    return;
  }

  const sanitizeColors = (value: string): string => {
    if (!value || typeof value !== 'string') return value;
    if (!value.includes('oklch') && !value.includes('color(')) return value;

    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;

    const resolveColor = (colorMatch: string): string => {
      try {
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          ctx = canvas.getContext('2d');
        }
        if (ctx) {
          ctx.fillStyle = colorMatch;
          return ctx.fillStyle || 'rgb(16, 185, 129)';
        }
      } catch {
        // Fallback
      }
      return 'rgb(16, 185, 129)';
    };

    const oklchRegex = /oklch\([^)]+\)/gi;
    let processed = value.replace(oklchRegex, resolveColor);

    const colorRegex = /color\([^)]+\)/gi;
    processed = processed.replace(colorRegex, resolveColor);

    return processed;
  };

  const sanitizeElementStyles = (el: HTMLElement) => {
    const styleAttr = el.getAttribute('style');
    if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('color('))) {
      el.setAttribute('style', sanitizeColors(styleAttr));
    }
    for (let i = 0; i < el.style.length; i++) {
      const key = el.style[i];
      const val = el.style.getPropertyValue(key);
      if (val && (val.includes('oklch') || val.includes('color('))) {
        el.style.setProperty(key, sanitizeColors(val));
      }
    }
    for (let i = 0; i < el.children.length; i++) {
      sanitizeElementStyles(el.children[i] as HTMLElement);
    }
  };

  // Safe prototype delegation that avoids any Proxy Illegal invocation errors
  const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
  const originalStyleSheets = Object.getOwnPropertyDescriptor(Document.prototype, 'styleSheets');

  let tempStyle: HTMLStyleElement | null = null;

  try {
    // Clone and prepare offscreen container styled beautifully for A4 PDF download
    const container = document.createElement('div');
    container.className = "p-8 bg-white text-slate-800 font-sans";
    container.style.width = '790px'; // standard printable A4 width in sub-rendered window

    // If it's a receipt or ID card, we want a tighter container
    const isIdCard = elementId === 'printable-id-card';
    const isReceipt = elementId === 'printable-savings-receipt' || elementId.includes('receipt') || filename.includes('receipt') || filename.includes('slip');

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

    const clone = element.cloneNode(true) as HTMLElement;
    
    // Adjust nested styling of the clone for high contrast legible display
    if (!isIdCard) {
      clone.style.backgroundColor = '#ffffff';
      clone.style.color = '#0f172a';
    } else {
      // Keep ID Cards fully styled as designed (dark green gradient badge)
      clone.style.backgroundColor = 'transparent';
    }
    
    // Remove any negative flex or spacing inside list controls if visible
    const ctrlButtons = clone.querySelectorAll('button, a, .no-print');
    ctrlButtons.forEach(btn => (btn as HTMLElement).style.display = 'none');

    // Remove oklch from cloned inline styles
    sanitizeElementStyles(clone);

    container.appendChild(clone);
    
    // Add professional footer
    if (!isIdCard) {
      const footer = document.createElement('div');
      footer.className = "mt-12 pt-4 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 font-sans";
      footer.innerHTML = `
        <span>রিপোর্ট আইডি: REF-${Math.floor(100000 + Math.random() * 900000)}</span>
        <span>স্বয়ংক্রিয় জেনারেটেড ক্লাউড পিডিএফ সিস্টেম</span>
      `;
      container.appendChild(footer);
    }

    // Append to body temporarily
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    const opt = {
      margin:       isIdCard ? 20 : isReceipt ? 10 : 15,
      filename:     filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2.5, useCORS: true, logging: false },
      jsPDF:        { 
        unit: 'mm' as const, 
        format: isReceipt ? ('a5' as const) : ('a4' as const), 
        orientation: isIdCard ? ('portrait' as const) : ('portrait' as const) 
      }
    };

    // Safely override getPropertyValue on the prototype to convert oklch colors on-the-fly
    CSSStyleDeclaration.prototype.getPropertyValue = function(property: string) {
      const value = originalGetPropertyValue.call(this, property);
      if (typeof value === 'string' && (value.includes('oklch') || value.includes('color('))) {
        return sanitizeColors(value);
      }
      return value;
    };

    // Gather and compile page styles into a single safe compiled stylesheet
    let combinedCssText = '';
    const styleSheetsList = Array.from(document.styleSheets);
    for (const sheet of styleSheetsList) {
      try {
        if (sheet.disabled) continue;
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (let i = 0; i < rules.length; i++) {
          combinedCssText += rules[i].cssText + '\n';
        }
      } catch (e) {
        // Safe cross-origin fallback
      }
    }

    // Sanitize the entire global stylesheet text
    const safeCssText = sanitizeColors(combinedCssText);

    // Create the temporary safe style node
    tempStyle = document.createElement('style');
    tempStyle.id = 'html2pdf-safe-style';
    tempStyle.textContent = safeCssText;
    document.head.appendChild(tempStyle);

    // Get the sheet reference
    const safeSheet = tempStyle.sheet;

    // Temporarily mock styleSheets inside document to return our beautiful parsed safeSheet
    try {
      Object.defineProperty(document, 'styleSheets', {
        get() {
          return safeSheet ? [safeSheet] : [];
        },
        configurable: true
      });
    } catch (e) {
      console.warn("Could not redefine styleSheets properties, proceeding naturally:", e);
    }

    // Run PDF generation
    await html2pdf().from(container).set(opt).save();
    
    // Cleanup container
    document.body.removeChild(container);
  } catch (error: any) {
    console.error('PDF Generation Failed:', error);
    alert('পিডিএফ ডাউনলোড তৈরি করা সম্ভব হচ্ছে না, অনুগ্রহ করে আবার চেষ্টা করুন বা ব্রাউজারের প্রিন্ট ফিচার ব্যবহার করুন।');
  } finally {
    // Clean up temporary styles
    if (tempStyle && tempStyle.parentNode) {
      tempStyle.parentNode.removeChild(tempStyle);
    }

    // Restore original prototype descriptors and getters
    CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
    if (originalStyleSheets) {
      try {
        Object.defineProperty(document, 'styleSheets', originalStyleSheets);
      } catch (e) {
        // Safe to ignore
      }
    } else {
      try {
        delete (document as any).styleSheets;
      } catch (e) {
        // Safe to ignore
      }
    }
  }
};
