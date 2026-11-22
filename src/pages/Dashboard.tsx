import { useData, focusJourney, opening, upcomingJourneys } from '../lib/store';
import { fmtDate, fmtHour, classLabel } from '../lib/time';
import { Countdown } from '../components/Countdown';
import { Card, Empty, JourneyLine, OpenIrctcButton, TrainRow } from '../components/ui';
import { ReadinessList, useReadiness } from '../components/Readiness';
import { useNow } from '../lib/hooks';
import { TrainSearch } from '../components/TrainSearch';

export default function Dashboard() {
  const data = useData();
  const t = useNow(30_000);
  const j = focusJourney(data.journeys, t);
  const { r } = useReadiness(j);

  if (!j)
    return (
      <div className="stack">
        <TrainSearch />
        <Card>
          <Empty
            text="Abhi koi booking plan nahi hai. Upar train number search karo aur BOOK THIS TRAIN dabao."
            action={<a className="btn btn-block" href="#/journeys/new">Ya khud journey bharo</a>}
          />
        </Card>
        <OpenIrctcButton />
        <QuickLinks />
      </div>
    );

  const o = opening(j);
  const others = upcomingJourneys(data.journeys, t).filter((x) => x.id !== j.id).slice(0, 3);
  const opened = t >= o.epoch;

  return (
    <div className="stack">
      <TrainSearch />
      <Card className="hero">
        <div className="row between">
          <span className="eyebrow">Next booking</span>
          {r && <span className={`score score-${r.ready ? 'ok' : r.score >= 70 ? 'warn' : 'bad'}`}>{r.score}%</span>}
        </div>
        <JourneyLine j={j} />
        <dl className="facts">
          <div><dt>Journey</dt><dd>{fmtDate(j.journeyDate)}</dd></div>
          <div><dt>Class</dt><dd>{classLabel(j.travelClass)}</dd></div>
          <div><dt>Booking opens</dt><dd>{fmtDate(o.openDate)}, {fmtHour(o.hour)} IST</dd></div>
          <div><dt>Passengers</dt><dd>{j.passengers.length}</dd></div>
        </dl>
        <div className="eyebrow center">{opened ? 'Booking window is open' : 'Countdown'}</div>
        <Countdown target={o.epoch} size="xl" />
        <a className="btn btn-block mb" href={`#/booking/${j.id}`}>Enter Booking Mode</a>
        <OpenIrctcButton big pulse={opened} />
      </Card>

      <Card title="Trains" right={<a className="link" href={`#/journeys/${j.id}`}>Edit</a>}>
        {j.trains.length ? (
          j.trains.map((tr, i) => <TrainRow key={i} t={tr} tag={i === 0 ? 'Preferred' : `Backup ${i}`} />)
        ) : (
          <Empty text="No train selected" action={<a className="btn btn-sm" href={`#/journeys/${j.id}`}>Add train</a>} />
        )}
      </Card>

      <Card title="Preparation">
        <ReadinessList j={j} onlyMissing />
      </Card>

      {others.length > 0 && (
        <Card title="Other upcoming">
          {others.map((x) => {
            const ox = opening(x);
            return (
              <a key={x.id} className="listrow" href={`#/booking/${x.id}`}>
                <JourneyLine j={x} />
                <span className="muted small">Opens {fmtDate(ox.openDate)} {fmtHour(ox.hour)}</span>
              </a>
            );
          })}
        </Card>
      )}
      <QuickLinks />
    </div>
  );
}

function QuickLinks() {
  return (
    <div className="grid2">
      <a className="btn" href="#/passengers">Passengers</a>
      <a className="btn" href="#/history">Booking history</a>
    </div>
  );
}
