// Bridges the app's existing component calls onto Bushido v2 public components.
// No layout lives here: each adapter maps props and renders the v2 component.
(function () {
  // App icon names (Font Awesome 6 style) → Bushido icon names. Unlisted names resolve by PascalCase.
  var ALIAS = {
    'table-cells': 'th', 'list-check': 'tasks', 'mobile-screen-button': 'mobile-alt', 'circle-exclamation': 'exclamation-circle',
    xmark: 'times', 'circle-check': 'check-circle', 'filter-circle-xmark': 'filter', 'user-pen': 'user-edit', 'circle-info': 'info-circle',
    'ellipsis-vertical': 'ellipsis-v', 'box-archive': 'archive', 'cloud-arrow-up': 'cloud-upload-alt', 'table-list': 'th-list',
    'arrow-up-right-from-square': 'external-link-alt', 'file-circle-exclamation': 'file', 'magnifying-glass': 'search',
    'triangle-exclamation': 'exclamation-triangle', display: 'desktop', 'user-magnifying-glass': 'search', 'angles-left': 'angle-double-left',
    'angles-right': 'angle-double-right', 'floppy-disk': 'save', 'up-right-and-down-left-from-center': 'expand-alt', 'rotate-left': 'undo-alt',
    'circle-dot': 'dot-circle', 'person-digging': 'hard-hat', gears: 'cogs', 'boxes-stacked': 'boxes', 'screwdriver-wrench': 'tools',
    'file-pen': 'file-signature', 'arrow-up-short-wide': 'sort-amount-up-alt', 'arrow-down-wide-short': 'sort-amount-down',
    'circle-minus': 'minus-circle', 'people-arrows': 'exchange-alt', 'up-right-from-square': 'external-link-alt'
  };
  var warned = {};
  function DS() { return window.BushidoDesignSystem_003450; }
  function h() { return window.React.createElement.apply(window.React, arguments); }
  function pascal(k) { return String(k).split('-').map(function (w) { return w ? w[0].toUpperCase() + w.slice(1) : ''; }).join(''); }
  function iconName(fa, outline) {
    var D = DS(); if (!fa) return 'IconFilledCircle';
    if (/^Icon(Filled|Outline|Brand)/.test(fa)) return fa;
    var key = ALIAS[fa] || fa, P = pascal(key);
    var tries = outline ? ['IconOutline' + P, 'IconFilled' + P] : ['IconFilled' + P, 'IconOutline' + P];
    for (var i = 0; i < tries.length; i++) { var r = D && D.ResolveIconName ? D.ResolveIconName(tries[i]) : tries[i]; if (r) return r; }
    if (!warned[fa]) { warned[fa] = 1; console.warn('[bushido-v2] no Bushido icon for "' + fa + '"'); }
    return 'IconFilledCircle';
  }
  function cssObj(css) {
    var o = {}; if (!css) return o; if (typeof css === 'object') return css;
    String(css).split(';').forEach(function (d) {
      var i = d.indexOf(':'); if (i < 0) return;
      var k = d.slice(0, i).trim(), v = d.slice(i + 1).trim(); if (!k) return;
      o[k.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); })] = v;
    });
    return o;
  }

  function Icon(p) {
    var D = DS(); var size = Number(p.size) || 14;
    var st = Object.assign({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, verticalAlign: '-0.125em', lineHeight: 0 }, cssObj(p.css));
    if (!D) return h('span', { style: st, 'aria-hidden': 'true' });
    return h('span', { style: st, 'aria-hidden': 'true', title: p.title }, h(D.Icon, { name: iconName(p.fa, p.variant === 'outline'), size: size }));
  }

  // v1 Button(variant neutral|primary|danger|warning|success, outlined, ghost, size small, leftIcon, disabled) → v2 Button.
  function Button(p) {
    var D = DS(); if (!D) return null;
    var v = p.variant || 'primary', variant;
    if (p.ghost) variant = 'ghost';
    else if (p.outlined) variant = 'outline';
    else variant = v === 'danger' ? 'danger' : v === 'neutral' ? 'secondary' : 'primary';
    var dis = !!p.disabled;
    return h(D.Button, {
      variant: variant, size: p.size === 'small' ? 'sm' : (p.size === 'large' ? 'lg' : 'md'),
      state: dis ? 'disabled' : undefined, block: !!p.block,
      showLeadingIcon: !!p.leftIcon, leadingIcon: p.leftIcon ? iconName(p.leftIcon) : undefined,
      onClick: function (e) { if (dis) { e && e.preventDefault && e.preventDefault(); return; } if (p.onClick) p.onClick(e); },
      type: p.type || 'button', style: p.style
    }, p.children);
  }

  function Select(p) {
    var D = DS(); if (!D) return null;
    return h(D.FormsSelect, {
      label: p.label || p.ariaLabel || 'Filter', showLabel: !!p.label, size: p.size === 'small' ? 'sm' : 'md',
      options: p.options, value: p.value, placeholder: p.placeholder,
      // FormsSelect adds an empty "Select an option" row; these selects always have a real value, so map "" back to the first option.
      onChange: function (v) {
        if (v === '' && p.options && p.options.length) { var o = p.options[0]; v = typeof o === 'string' ? o : o.value; }
        if (p.onChange) p.onChange(v);
      },
      style: Object.assign({ width: Number(p.width) || 200 }, p.style || {})
    });
  }

  // v2 has no Search Input: a label-less FormsTextField, with a v2 IconButton to clear it.
  function SearchInput(p) {
    var D = DS(); if (!D) return null;
    var w = Number(p.width) || 240;
    return h('span', { style: { position: 'relative', display: 'inline-block', width: w } },
      h(D.FormsTextField, { label: p.placeholder || 'Search', showLabel: false, size: p.size === 'small' ? 'sm' : 'md', placeholder: p.placeholder,
        value: p.value || '', onChange: function (v) { if (p.onChange) p.onChange(v); }, style: { width: w } }),
      p.onClear && p.value ? h('span', { style: { position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' } },
        h(D.IconButton, { icon: 'IconFilledTimes', variant: 'ghost', size: 'sm', ariaLabel: 'Clear search', onClick: p.onClear })) : null);
  }

  function Panel(p) { var D = DS(); if (!D) return null; return h(D.Container, { size: 'sm', title: p.title, style: Object.assign({ width: '100%', boxSizing: 'border-box' }, p.style || {}) }, p.children); }
  function Message(p) {
    var D = DS(); if (!D) return null;
    var map = { warning: 'warning', danger: 'danger', error: 'danger', success: 'success', info: 'info' };
    var txt = typeof p.children === 'string' ? p.children : undefined;
    return h(D.Alert, { intent: map[p.variant] || 'info', title: p.title, description: txt, showDescription: !!txt, style: { width: '100%', boxSizing: 'border-box' } }, txt ? undefined : p.children);
  }

  window.JJ = { Icon: Icon, Button: Button, Select: Select, SearchInput: SearchInput, Panel: Panel, Message: Message, iconName: iconName };
})();
