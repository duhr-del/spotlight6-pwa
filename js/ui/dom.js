// Мини-хелперы для построения DOM без шаблонных строк и innerHTML.

export function h(tag, props = null, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const key of Object.keys(props)) {
      const value = props[key];
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'style' && typeof value === 'object') {
        for (const [prop, val] of Object.entries(value)) {
          if (val === null || val === undefined) continue;
          if (prop.startsWith('--')) node.style.setProperty(prop, String(val));
          else node.style[prop] = val;
        }
      }
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'text') node.textContent = value;
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    }
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

// Для root.replaceChildren(...nodes(a, b, c)): убирает null,
// иначе браузер вставит их как текст «null».
export function nodes(...items) {
  return items.filter((item) => item !== null && item !== undefined && item !== false);
}

export function progressBar(percent, className = '') {
  const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return h(
    'div',
    { class: `bar ${className}`.trim(), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(clamped) },
    h('span', { class: 'bar__fill', style: { width: `${clamped}%` } })
  );
}

let toastTimer = null;

export function toast(message, kind = 'info') {
  let node = document.getElementById('toast');
  if (!node) {
    node = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(node);
  }
  node.textContent = message;
  node.className = `toast toast--${kind} is-visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.className = 'toast'; }, 2800);
}

export function plural(number, one, few, many) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}