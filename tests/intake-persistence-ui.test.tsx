import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewCaseModal } from '@/components/NewCaseModal';

function setInput(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('opportunity intake navigation, review, submission and reload', () => {
  beforeEach(() => localStorage.clear());

  it('keeps one atomic draft across tabs, review edits and a browser reload', () => {
    const create = vi.fn();
    const first = render(<NewCaseModal isOpen onClose={vi.fn()} onCreateCase={create} />);
    setInput('Opportunity title', 'Sudirman Green Link — Synthetic Study');
    setInput('Site address', 'Jl. Jenderal Sudirman, Jakarta');
    setInput('Site area', '12000');
    setInput('Street frontage', '100');
    setInput('Lot depth', '120');
    setInput('Development intent', 'Transit-oriented retail, offices, residences, hotel, shaded pedestrian space, public plaza and phased investment');

    fireEvent.click(screen.getByRole('button', { name: /2\. Existing Asset/i }));
    setInput('Existing building GFA', '6000');
    setInput('Existing storeys', '3');

    fireEvent.click(screen.getByRole('button', { name: /3\. Planning Limits/i }));
    setInput('Maximum FAR KLB', '7');
    setInput('Maximum KDB percent', '50');
    setInput('Minimum KDH percent', '25');
    setInput('Maximum height', '180');
    setInput('Front setback', '10');
    setInput('Rear setback', '8');
    setInput('Side setbacks', '6');

    fireEvent.click(screen.getByRole('button', { name: /4\. Commercials/i }));
    setInput('Asking price', '1800000000000');
    setInput('NJOP benchmark', '1200000000000');

    fireEvent.click(screen.getByRole('button', { name: /3\. Planning Limits/i }));
    expect((screen.getByLabelText('Maximum FAR KLB') as HTMLInputElement).value).toBe('7');
    expect((screen.getByLabelText('Minimum KDH percent') as HTMLInputElement).value).toBe('25');
    fireEvent.click(screen.getByRole('button', { name: /2\. Existing Asset/i }));
    expect((screen.getByLabelText('Existing building GFA') as HTMLInputElement).value).toBe('6000');

    first.unmount();
    render(<NewCaseModal isOpen onClose={vi.fn()} onCreateCase={create} />);
    expect((screen.getByLabelText('Opportunity title') as HTMLInputElement).value).toBe('Sudirman Green Link — Synthetic Study');
    fireEvent.click(screen.getByRole('button', { name: /4\. Commercials/i }));
    expect((screen.getByLabelText('Asking price') as HTMLInputElement).value).toBe('1800000000000');

    fireEvent.click(screen.getByRole('button', { name: /Review Opportunity & 3 Schemes/i }));
    expect(screen.getByRole('region', { name: 'Review and confirm opportunity inputs' })).toBeDefined();
    expect(screen.getByText(/KDH not demonstrated/)).toBeDefined();
    expect(screen.getByText(/Commercial figures.*unverified/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Edit planning/i }));
    expect((screen.getByLabelText('Maximum FAR KLB') as HTMLInputElement).value).toBe('7');
    setInput('Maximum FAR KLB', '0');
    expect((screen.getByLabelText('Maximum FAR KLB') as HTMLInputElement).value).toBe('0');
    setInput('Maximum FAR KLB', '7');

    fireEvent.click(screen.getByRole('button', { name: /Review Opportunity & 3 Schemes/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm snapshot & create opportunity \+ 3 schemes/i }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      grossSiteArea: 12000, frontageLength: 100, lotDepth: 120,
      existingBuildingGFA: 6000, existingFloors: 3,
      statutoryMaxFAR: 7, statutoryMaxCoveragePct: 50, statutoryMinKDHPct: 25,
      statutoryMaxHeightMeters: 180, setbackFront: 10, setbackRear: 8,
      setbackSideLeft: 6, setbackSideRight: 6,
      askingPriceAmount: 1800000000000, njopAmount: 1200000000000,
    });
  });
});
