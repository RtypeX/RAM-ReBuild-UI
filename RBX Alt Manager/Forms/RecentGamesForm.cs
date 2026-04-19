using RBX_Alt_Manager.Classes;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;

namespace RBX_Alt_Manager.Forms
{
    public partial class RecentGamesForm : Form
    {
        public event EventHandler<GameArgs> RecentGameSelected;

        public RecentGamesForm()
        {
            InitializeComponent();
            this.Rescale();

            AccountManager.Instance.RecentGameAdded += Instance_RecentGameAdded;
        }

        public void ShowForm()
        {
            Show();

            TopMost = true;
            Location = new Point(Cursor.Position.X - 2, Cursor.Position.Y - 2);
        }

        public void LoadGames(List<Game> Games)
        {
            for (int i = Games.Count - 1; i >= 0; i--) //            foreach (Game game in Games)
                AddGameControl(Games[i]);
        }

        private void AddGameControl(Game Game)
        {
            GameControl RControl = new GameControl(Game);

            RControl.Selected += RControl_Selected;
            RControl.Exited += (s, e) => Hide();

            GamesPanel.Controls.Add(RControl);
        }

        private void Instance_RecentGameAdded(object sender, GameArgs e)
        {
            GamesPanel.Controls.Clear();

            AddGameControl(e.Game);

            for (int i = AccountManager.RecentGames.Count - 2; i >= 0; i--)
                AddGameControl(AccountManager.RecentGames[i]);
        }

        private void RControl_Selected(object sender, GameArgs e)
        {
            RecentGameSelected?.Invoke(this, new GameArgs(e.Game));

            Hide();
        }

        private void GamesPanel_MouseLeave(object sender, EventArgs e)
        {
            if (!ClientRectangle.Contains(PointToClient(Cursor.Position)))
                Hide();
        }

        private void RecentGamesForm_FormClosing(object sender, FormClosingEventArgs e) =>
            e.Cancel = true;

        private void RecentGamesForm_Shown(object sender, EventArgs e) =>
            Location = new Point(Cursor.Position.X - 2, Cursor.Position.Y - 2);

        #region Themes

        public void ApplyTheme()
        {
            BackColor = ThemeEditor.FormsBackground.DarkenOrBrighten(0.12f);
            ForeColor = ThemeEditor.FormsForeground;

            ApplyTheme(Controls);
        }

        public void ApplyTheme(Control.ControlCollection _Controls)
        {
            _Controls.ApplyTheme();
        }

        #endregion
    }
}
