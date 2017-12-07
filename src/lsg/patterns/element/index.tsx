import { colors } from '../colors';
import { Icon, IconName, Size as IconSize } from '../icons';
import * as React from 'react';
import { getSpace, Size } from '../space';
import styled from 'styled-components';

export interface ElementProps {
	active?: boolean;
	open?: boolean;
	title: string;

	handleIconClick?: React.MouseEventHandler<SVGSVGElement>;
}

export interface StyledElementChildProps {
	open?: boolean;
}

const StyledElement = styled.div`
	padding: 0 ${getSpace(Size.M)}px;
	border-radius: 3px;
	${(props: ElementProps) =>
		props.active
			? `
				color: ${colors.white.toString()};
				background: ${colors.blue.toString()};
			`
			: `
				color: ${colors.black.toString()};
				background: ${colors.grey90.toString()};
			`};
`;

const StyledElementLabel = styled.div`
	display: flex;
	min-height: 30px;
	align-items: center;
`;

const StyledElementChild = styled.div`
	flex-basis: 100%;
	padding-left: ${getSpace(Size.M)}px;
	${(props: StyledElementChildProps) => (props.open ? 'display: block;' : 'display: none;')};
`;

const StyledIcon = styled(Icon)`
	margin-right: 20px;
	fill: ${colors.grey70.toString()};
`;

const Element: React.StatelessComponent<ElementProps> = props => {
	const { children, title, active, open, handleIconClick } = props;

	return (
		<StyledElement title={title} active={active}>
			<StyledElementLabel>
				{children && (
					<StyledIcon
						handleClick={handleIconClick}
						name={IconName.Robo}
						size={IconSize.XS}
						color={colors.grey70}
					/>
				)}
				{title}
			</StyledElementLabel>
			{children && <StyledElementChild open={open}>{children}</StyledElementChild>}
		</StyledElement>
	);
};

export default Element;
