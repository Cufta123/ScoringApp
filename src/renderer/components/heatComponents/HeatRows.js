import React from 'react';
import PropTypes from 'prop-types';
import Flag from 'react-world-flags';
import iocToFlagCodeMap from '../../constants/iocToFlagCodeMap';

export default function HeatRows({
  heat,
  raceHappened,
  finalSeriesStarted,
  boatNumberColumnStyle,
  sailorNameColumnStyle,
}) {
  const getFlagCode = (iocCode) => {
    return iocToFlagCodeMap[iocCode] || iocCode;
  };

  const handleDragStart = (e, boat, fromHeatId) => {
    const { nativeEvent } = e;
    nativeEvent.dataTransfer.setData(
      'application/json',
      JSON.stringify({ boat, fromHeatId }),
    );
  };

  return (
    <tbody>
      {heat.boats.map((boat) => (
        <tr
          key={boat.boat_id}
          draggable={!raceHappened && !finalSeriesStarted}
          onDragStart={(e) => handleDragStart(e, boat, heat.heat_id)}
        >
          <td style={sailorNameColumnStyle}>
            {boat.name} {boat.surname}
          </td>
          <td>
            <Flag
              code={getFlagCode(boat.country)}
              style={{ width: '30px', marginRight: '5px' }}
            />
            {boat.country}
          </td>
          <td style={boatNumberColumnStyle}>{boat.sail_number}</td>
        </tr>
      ))}
    </tbody>
  );
}

HeatRows.propTypes = {
  heat: PropTypes.shape({
    heat_id: PropTypes.number.isRequired,
    heat_name: PropTypes.string.isRequired,
    raceNumber: PropTypes.number.isRequired,
    boats: PropTypes.arrayOf(
      PropTypes.shape({
        boat_id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        surname: PropTypes.string.isRequired,
        country: PropTypes.string.isRequired,
        sail_number: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
          .isRequired,
      }),
    ).isRequired,
  }).isRequired,
  raceHappened: PropTypes.bool.isRequired,
  finalSeriesStarted: PropTypes.bool.isRequired,
  boatNumberColumnStyle: PropTypes.shape({
    maxWidth: PropTypes.string,
  }).isRequired,
  sailorNameColumnStyle: PropTypes.shape({
    maxWidth: PropTypes.string,
  }).isRequired,
};
