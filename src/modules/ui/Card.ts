/**
 * Card Component - KPI/asset card for dashboard
 * Displays title with metric grid, supports positive (green) and negative (red) values
 */

export interface CardMetric {
  label: string;
  value: string | number;
  isPositive?: boolean;
  isBold?: boolean;
}

/**
 * Create a KPI card with title and metric grid
 * @param title Card title
 * @param values Record of metric labels to values, or array of CardMetric objects
 * @param options Optional styling options
 */
export function createCard(
  title: string,
  values: Record<string, string | number> | CardMetric[],
  options: {
    accentColor?: string;
    bordered?: boolean;
    fullWidth?: boolean;
  } = {}
): HTMLElement {
  const {
    accentColor = '#ffd700',
    bordered = true,
    fullWidth = false,
  } = options;

  const card = document.createElement('div');
  card.className = 'kpi-card';
  card.style.cssText = `
    background: #242424;
    border-radius: 12px;
    padding: 1.5rem;
    ${bordered ? `border: 2px solid ${accentColor};` : 'border: 1px solid #3a3a3a;'}
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transition: all 200ms ease;
    ${fullWidth ? 'width: 100%;' : ''}
  `;

  // Title
  const titleEl = document.createElement('h3');
  titleEl.textContent = title;
  titleEl.style.cssText = `
    color: #ffffff;
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  `;

  // Accent bar
  const accentBar = document.createElement('div');
  accentBar.style.cssText = `
    width: 4px;
    height: 1.5rem;
    background: ${accentColor};
    border-radius: 2px;
  `;
  titleEl.insertBefore(accentBar, titleEl.firstChild);

  card.appendChild(titleEl);

  // Metrics grid
  const metricsGrid = document.createElement('div');
  metricsGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
  `;

  // Convert values to CardMetric array
  let metrics: CardMetric[] = [];
  if (Array.isArray(values)) {
    metrics = values;
  } else {
    metrics = Object.entries(values).map(([label, value]) => ({
      label,
      value,
      isPositive: true,
    }));
  }

  // Create metric rows
  metrics.forEach((metric) => {
    const metricRow = document.createElement('div');
    metricRow.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    `;

    const label = document.createElement('span');
    label.textContent = metric.label;
    label.style.cssText = `
      color: #a0a0a0;
      font-size: 0.9rem;
      font-weight: 500;
    `;

    const valueEl = document.createElement('span');
    valueEl.textContent = String(metric.value);
    valueEl.style.cssText = `
      color: ${getValueColor(metric.isPositive)};
      font-size: ${metric.isBold ? '1.4rem' : '1.1rem'};
      font-weight: ${metric.isBold ? '700' : '600'};
      word-break: break-word;
    `;

    metricRow.appendChild(label);
    metricRow.appendChild(valueEl);
    metricsGrid.appendChild(metricRow);
  });

  card.appendChild(metricsGrid);

  // Hover effect
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-4px)';
    card.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
  });

  return card;
}

/**
 * Create a simple metric card (single value)
 * @param title Card title
 * @param value Main metric value
 * @param subtitle Optional subtitle
 * @param color Color of the value (auto-determined if not provided)
 */
export function createMetricCard(
  title: string,
  value: string | number,
  subtitle?: string,
  color?: string
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'metric-card';
  card.style.cssText = `
    background: #242424;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #3a3a3a;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    text-align: center;
    transition: all 200ms ease;
  `;

  const titleEl = document.createElement('h3');
  titleEl.textContent = title;
  titleEl.style.cssText = `
    color: #a0a0a0;
    font-size: 0.9rem;
    font-weight: 500;
    margin: 0 0 1rem 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;

  const valueEl = document.createElement('div');
  valueEl.textContent = String(value);
  valueEl.style.cssText = `
    color: ${color || '#ffd700'};
    font-size: 2rem;
    font-weight: 700;
    word-break: break-word;
  `;

  card.appendChild(titleEl);
  card.appendChild(valueEl);

  if (subtitle) {
    const subtitleEl = document.createElement('p');
    subtitleEl.textContent = subtitle;
    subtitleEl.style.cssText = `
      color: #707070;
      font-size: 0.85rem;
      margin: 0.75rem 0 0 0;
    `;
    card.appendChild(subtitleEl);
  }

  // Hover effect
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-4px)';
    card.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
  });

  return card;
}

/**
 * Determine color based on positive/negative value
 */
function getValueColor(isPositive?: boolean): string {
  if (isPositive === undefined) return '#ffffff';
  return isPositive ? '#28a745' : '#dc3545';
}
