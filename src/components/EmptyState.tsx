import ContentCard from './ContentCard';
import Illustration, { type IllustrationKind } from './Illustration';

export default function EmptyState({ title, description, illustration }: {
  title: string;
  description: string;
  illustration: IllustrationKind;
}) {
  return <ContentCard as="div" className="content-state empty-state">
    <Illustration kind={illustration}/>
    <div><h3>{title}</h3><p>{description}</p></div>
  </ContentCard>;
}
