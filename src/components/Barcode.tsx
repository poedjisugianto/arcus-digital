import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface Props {
  value: string;
  format?: 'CODE128' | 'CODE39' | 'EAN13' | 'UPC';
  width?: number;
  height?: number;
  displayValue?: boolean;
  text?: string;
  fontOptions?: string;
  font?: string;
  textAlign?: 'left' | 'center' | 'right';
  textPosition?: 'bottom' | 'top';
  textMargin?: number;
  fontSize?: number;
  background?: string;
  lineColor?: string;
  margin?: number;
  className?: string;
}

export const Barcode: React.FC<Props> = ({
  value,
  format = 'CODE128',
  width = 1.5,
  height = 40,
  displayValue = true,
  text,
  fontOptions = '',
  font = 'monospace',
  textAlign = 'center',
  textPosition = 'bottom',
  textMargin = 2,
  fontSize = 10,
  background = 'transparent',
  lineColor = '#000000',
  margin = 0,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      JsBarcode(svgRef.current, String(value), {
        format,
        width,
        height,
        displayValue,
        text,
        fontOptions,
        font,
        textAlign,
        textPosition,
        textMargin,
        fontSize,
        background,
        lineColor,
        margin
      });
    } catch (err) {
      console.warn('Failed to render barcode:', err);
    }
  }, [
    value,
    format,
    width,
    height,
    displayValue,
    text,
    fontOptions,
    font,
    textAlign,
    textPosition,
    textMargin,
    fontSize,
    background,
    lineColor,
    margin
  ]);

  if (!value) return null;

  return (
    <svg 
      ref={svgRef} 
      className={`barcode-svg max-w-full inline-block ${className}`}
      style={{ display: 'block', margin: '0 auto' }}
    />
  );
};

export default Barcode;
