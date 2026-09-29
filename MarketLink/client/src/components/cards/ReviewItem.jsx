import { Link } from 'react-router-dom';
import RatingStars from '../common/RatingStars';
import { timeAgo } from '../../utils/format';
import { productPath } from '../../utils/links';
import Avatar from '../common/Avatar';
import ReportButton from '../reviews/ReportButton';
import VerifiedBadge from '../reviews/VerifiedBadge';
import { useAuth } from '../../context/AuthContext';
import { productName, t } from '../../i18n';
import ReplyBox from '../reviews/ReplyBox';

/** One review. `canReply`: the stall's own farmer sees "Reply" / "Edit reply" right under it. */
export default function ReviewItem({ review, showProduct = false, farmerName, reportable = true, canReply = false, onReplied }) {
  const { user } = useAuth();
  const canReport = reportable && user && String(user._id) !== String(review.customer?._id || review.customer);
  return (
    <div className="review-item">
      <div className="d-flex align-items-center gap-2 mb-1">
        <Avatar name={review.customer?.name || 'Customer'} src={review.customer?.avatar} className="avatar-sm" />
        <div className="flex-grow-1">
          <strong className="small">{review.customer?.name || t('Customer')}</strong> <VerifiedBadge verified={review.verified} />
          <div className="fs-7 text-muted-2">{timeAgo(review.createdAt)}</div>
        </div>
        <RatingStars value={review.rating} />
      </div>
      {showProduct && review.product?.name && (
        <div className="fs-7 text-muted-2 mb-1">
          {t('on')} <Link to={productPath(review.product)}>{productName(review.product)}</Link>
        </div>
      )}
      {review.comment && <p className="mb-0 small">{review.comment}</p>}
      {review.response?.text && (
        <div className="farmer-reply">
          <strong className="d-block fs-7 text-success mb-1">
            <i className="bi bi-reply-fill" /> {t('Reply from {name}', { name: farmerName || t('the farmer') })}
          </strong>
          {review.response.text}
        </div>
      )}
      {canReply && <ReplyBox review={review} onSaved={onReplied} />}
      {canReport && <ReportButton targetType="review" targetId={review._id} className="review-report" />}
    </div>
  );
}
