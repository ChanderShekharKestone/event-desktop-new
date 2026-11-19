import { useParams } from 'react-router-dom';
import { apiPublicLead } from '../../apiPath';
import ScannerScreen from './ScannerScreen';

/** Public scanner for one booth / room — opened from its own LAN link (#/lead/:token), no login */
const LeadScanner = () => {
  const { token } = useParams();
  return <ScannerScreen key={token} base={apiPublicLead(token)} />;
};

export default LeadScanner;
