using System;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace RBX_Alt_Manager.Classes
{
    public class MenuButton : Button // Thank you, fellow developer: https://stackoverflow.com/a/24087828
    {
        private int MenuHotZoneWidth => (int)(22 * Program.Scale);

        [DefaultValue(null)]
        public ContextMenuStrip Menu { get; set; }

        [DefaultValue(false)]
        public bool ShowMenuUnderCursor { get; set; }

        protected override void OnMouseDown(MouseEventArgs mevent)
        {
            int hotZoneStart = ClientRectangle.Width - Math.Max(Padding.Right, 6) - MenuHotZoneWidth;

            if (Menu != null && (mevent.Button == MouseButtons.Right || (mevent.Button == MouseButtons.Left && mevent.X >= hotZoneStart)))
            {
                Point menuLocation;

                if (ShowMenuUnderCursor)
                    menuLocation = mevent.Location;
                else
                    menuLocation = new Point(0, Height - 1);

                Menu.Show(this, menuLocation);
                Capture = false;
                return;
            }

            base.OnMouseDown(mevent);
        }

        protected override void OnPaint(PaintEventArgs pevent)
        {
            base.OnPaint(pevent);

            if (Menu != null)
            {
                pevent.Graphics.SmoothingMode = SmoothingMode.AntiAlias;

                int menuAreaWidth = MenuHotZoneWidth;
                int rightInset = Math.Max(Padding.Right, 6);
                int dividerX = ClientRectangle.Right - rightInset - menuAreaWidth;
                int arrowX = ClientRectangle.Width - rightInset - (int)(11 * Program.Scale);
                int arrowY = (ClientRectangle.Height / 2) - (int)(1 * Program.Scale);

                Color color = Enabled ? ForeColor : SystemColors.ControlDark;

                using (Pen dividerPen = new Pen(Color.FromArgb(90, color)))
                    pevent.Graphics.DrawLine(dividerPen, dividerX, Padding.Top + 4, dividerX, Height - Padding.Bottom - 5);

                using (Brush brush = new SolidBrush(color))
                {
                    Point[] arrows = new Point[]
                    {
                        new Point(arrowX, arrowY),
                        new Point((int)(arrowX + 7 * Program.Scale), arrowY),
                        new Point((int)(arrowX + 3.5f * Program.Scale), (int)(arrowY + 4 * Program.Scale))
                    };

                    pevent.Graphics.FillPolygon(brush, arrows);
                }
            }
        }
    }
}
