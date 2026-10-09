import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Table, TableCaption, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, TableNumericCell } from './Table';

/**
 * Table markup is asserted rather than style: the risk in a table is a broken
 * accessibility structure (missing caption, wrong scope), which shows up in the
 * markup itself.
 */
describe('Table', () => {
  const sample = (
    <Table>
      <TableCaption>Holdings</TableCaption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Fund</TableHeaderCell>
          <TableHeaderCell>Value</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell>Parag Parag Flexi</TableCell>
          <TableNumericCell>1,20,000</TableNumericCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  it('renders semantic table structure', () => {
    const html = renderToStaticMarkup(sample);
    expect(html).toContain('<table');
    expect(html).toContain('<caption');
    expect(html).toContain('<thead');
    expect(html).toContain('<tbody');
  });

  it('defaults column headers to scope=col', () => {
    const html = renderToStaticMarkup(sample);
    expect(html.match(/scope="col"/g)).toHaveLength(2);
  });

  it('honours an explicit row scope', () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableBody>
          <TableRow>
            <TableHeaderCell scope="row">Parag Parag Flexi</TableHeaderCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(html).toContain('scope="row"');
  });

  it('aligns numeric cells right with tabular figures', () => {
    const html = renderToStaticMarkup(sample);
    expect(html).toMatch(/<td class="[^"]*text-right[^"]*tabular-nums/);
  });

  it('wraps the table so a wide table scrolls instead of overflowing', () => {
    expect(renderToStaticMarkup(sample)).toContain('overflow-x-auto');
  });
});
