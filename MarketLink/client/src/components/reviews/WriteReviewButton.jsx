import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import ReviewModal from './ReviewModal';
import { t } from '../../i18n';

/** "Write a review" on product and farmer pages. Buyers write verified reviews, everyone else unverified ones. */
export default function WriteReviewButton({ type, id, name, onDone }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const isCustomer = user?.role === 'customer';
  const { data, reload } = useFetch(isCustomer ? `/reviews/eligible?${type}=${id}` : null);

  if (!user) {
    return (
      <Link to="/login" className="btn btn-white btn-sm">
        <i className="bi bi-pencil-square" /> {t('Log in to review')}
      </Link>
    );
  }
  if (!isCustomer) return null;
  if (!data?.canReview) {
    return <span className="small text-muted-2">{data?.reason || ''}</span>;
  }
  return (
    <>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        <i className="bi bi-pencil-square" /> {t('Write a review')}
      </button>
      {open && (
        <ReviewModal
          target={{ type, orderId: data.orderId, orderNumber: data.orderNumber, productId: type === 'product' ? id : undefined, farmerId: type === 'farmer' ? id : undefined, name }}
          onClose={() => setOpen(false)}
          onDone={(res) => {
            setOpen(false);
            reload();
            onDone?.(res);
          }}
        />
      )}
    </>
  );
}
