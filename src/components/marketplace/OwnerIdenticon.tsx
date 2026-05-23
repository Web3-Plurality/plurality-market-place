import styled from 'styled-components';

interface Props {
  address: string;
  size?: number;
}

const Circle = styled.div<{ $size: number; $color1: string; $color2: string }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  min-width: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${({ $color1 }) => $color1}, ${({ $color2 }) => $color2});
`;

function hashAddress(address: string): number[] {
  const clean = address.toLowerCase().replace('0x', '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length && bytes.length < 6; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16) || 0);
  }
  while (bytes.length < 6) bytes.push(128);
  return bytes;
}

function bytesToColor(b1: number, b2: number, b3: number): string {
  return `rgb(${b1}, ${b2}, ${b3})`;
}

const OwnerIdenticon = ({ address, size = 24 }: Props) => {
  const bytes = hashAddress(address);
  const color1 = bytesToColor(bytes[0], bytes[1], bytes[2]);
  const color2 = bytesToColor(bytes[3], bytes[4], bytes[5]);

  return <Circle $size={size} $color1={color1} $color2={color2} title={address} />;
};

export default OwnerIdenticon;
