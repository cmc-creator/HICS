import { Link } from 'react-router-dom';

export default function EnterpriseFooter() {
  return (
    <footer className="px-4 py-4 mt-auto">
      <div className="max-w-7xl mx-auto nyx-panel p-3 text-[11px] text-gray-500 leading-relaxed">
        <p>NyxHICSlab™ is a product of Nyx Collective LLC.</p>
        <p className="mt-1">© 2026 Nyx Collective LLC. All rights reserved.</p>
        <p className="mt-1">NyxHICSlab, NyxCollective, and related names, logos, product marks, and design marks are trademarks of Nyx Collective LLC.</p>
        <p className="mt-2 flex gap-3">
          <Link to="/tos" className="hover:underline text-gray-400">Terms of Service</Link>
          <span aria-hidden>·</span>
          <Link to="/privacy" className="hover:underline text-gray-400">Privacy Policy</Link>
          <span aria-hidden>·</span>
          <a href="https://nyxcollectivellc.com" target="_blank" rel="noreferrer" className="hover:underline text-gray-400">nyxcollectivellc.com</a>
        </p>
      </div>
    </footer>
  );
}
